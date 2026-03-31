"""LakeHouse Lab — API Views"""
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from lakehouse.catalog.duckdb_connector import list_tables, profile_table, get_all_schemas
from lakehouse.models import CatalogEntry, DataSource, DbtRun, IngestionLog, QuerySession
from lakehouse.query_agent.engine import ask
from lakehouse.tasks import run_dbt_task, run_ingestion_task

from .serializers import (
    CatalogEntrySerializer, DataSourceSerializer, DbtRunSerializer,
    FileUploadSerializer, IngestionLogSerializer, QueryCreateSerializer,
    QuerySessionSerializer,
)


class DataSourceViewSet(viewsets.ModelViewSet):
    """CRUD de fontes + ingestão + upload. Leitura pública; escrita requer JWT."""

    queryset = DataSource.objects.prefetch_related("ingestion_logs").all()
    serializer_class = DataSourceSerializer
    authentication_classes = [JWTAuthentication]

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    @action(detail=True, methods=["post"])
    def ingest(self, request, pk=None):
        """Dispara ingestão de uma fonte."""
        source = self.get_object()
        run_ingestion_task.delay(str(source.id))
        return Response({"message": f"Ingestão de '{source.display_name}' disparada."}, status=status.HTTP_202_ACCEPTED)

    @action(detail=False, methods=["post"], parser_classes=[MultiPartParser, FormParser])
    def upload(self, request):
        """Upload de CSV/JSON como nova fonte."""
        serializer = FileUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        uploaded = serializer.validated_data["file"]
        name = serializer.validated_data["name"]
        display_name = serializer.validated_data.get("display_name") or name

        content = uploaded.read().decode("utf-8", errors="replace")
        is_json = uploaded.name.endswith(".json")
        source_type = "json_upload" if is_json else "csv_upload"

        source, created = DataSource.objects.update_or_create(
            name=name,
            defaults={"display_name": display_name, "source_type": source_type, "config": {"content": content[:500000]}},
        )

        run_ingestion_task.delay(str(source.id), config_override={"content": content})

        return Response(
            {"message": f"Upload recebido. Ingestão disparada.", "source_id": str(source.id)},
            status=status.HTTP_202_ACCEPTED,
        )


class IngestionLogViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = IngestionLog.objects.select_related("source").all()
    serializer_class = IngestionLogSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get_queryset(self):
        qs = super().get_queryset()
        source = self.request.query_params.get("source")
        if source:
            qs = qs.filter(source_id=source)
        return qs


class CatalogViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = CatalogEntry.objects.all()
    serializer_class = CatalogEntrySerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    lookup_field = "table_name"

    @action(detail=False, methods=["get"])
    def discover(self, request):
        """Descobre tabelas no DuckDB e retorna lista."""
        tables = list_tables()
        return Response(tables)

    @action(detail=False, methods=["get"])
    def schema(self, request):
        """Schema de todas as tabelas para autocomplete: {table_name: [col_name]}."""
        return Response(get_all_schemas())

    @action(detail=True, methods=["get"], url_path="profile")
    def table_profile(self, request, table_name=None):
        """Profiling de uma tabela."""
        profile = profile_table(table_name)
        return Response(profile)


class QueryView(APIView):
    """POST /api/query/ — Pergunta em linguagem natural → SQL → resultado."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = QueryCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        question = serializer.validated_data["question"]
        provider = serializer.validated_data.get("provider")
        model = serializer.validated_data.get("model")
        result = ask(question, provider=provider, model=model)

        # Persiste a sessão
        session = QuerySession.objects.create(
            user_question=question,
            generated_sql=result.get("sql", ""),
            result_preview=result.get("rows", [])[:50],
            result_columns=result.get("columns", []),
            row_count=result.get("row_count", 0),
            execution_time_ms=result.get("execution_time_ms", 0),
            tokens_used=result.get("tokens_used", 0),
            chart_type=result.get("chart_type", "table"),
            error_message=result.get("error", ""),
            llm_provider=result.get("llm_provider", ""),
            llm_model=result.get("llm_model", ""),
        )

        return Response(QuerySessionSerializer(session).data)


class QueryHistoryView(APIView):
    """GET /api/query/history/ — Histórico de queries."""
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        sessions = QuerySession.objects.all()[:20]
        return Response(QuerySessionSerializer(sessions, many=True).data)


class DbtRunView(APIView):
    """POST /api/dbt/run/ — Executar dbt."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        command = request.data.get("command", "run")
        select = request.data.get("select", "")
        run_dbt_task.delay(command, select)
        return Response({"message": f"dbt {command} disparado."}, status=status.HTTP_202_ACCEPTED)


class DbtModelsView(APIView):
    """GET /api/dbt/models/ — Listar últimas execuções dbt."""
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        runs = DbtRun.objects.all()[:10]
        return Response(DbtRunSerializer(runs, many=True).data)


class DbtLineageView(APIView):
    """GET /api/dbt/lineage/ — Grafo de lineage do dbt manifest.json."""
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        import json
        from django.conf import settings
        from pathlib import Path

        manifest_path = Path(settings.DBT_PROJECT_DIR) / "target" / "manifest.json"
        if not manifest_path.exists():
            return Response({"nodes": [], "edges": [], "error": "manifest.json não encontrado. Execute dbt run primeiro."})

        with open(manifest_path) as f:
            manifest = json.load(f)

        nodes = []
        edges = []

        for node_id, node in manifest.get("nodes", {}).items():
            if node.get("resource_type") != "model":
                continue
            path = node.get("original_file_path", "")
            if "staging" in path:
                layer = "staging"
            elif "intermediate" in path:
                layer = "intermediate"
            else:
                layer = "marts"

            nodes.append({
                "id": node_id,
                "name": node["name"],
                "layer": layer,
                "description": node.get("description", ""),
            })

            for dep in node.get("depends_on", {}).get("nodes", []):
                if dep.startswith("model."):
                    edges.append({"source": dep, "target": node_id})

        return Response({"nodes": nodes, "edges": edges})
