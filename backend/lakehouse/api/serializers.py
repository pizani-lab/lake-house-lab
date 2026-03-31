"""LakeHouse Lab — API Serializers"""
from rest_framework import serializers
from lakehouse.models import CatalogEntry, DataSource, DbtRun, IngestionLog, QuerySession


class DataSourceSerializer(serializers.ModelSerializer):
    last_ingestion = serializers.SerializerMethodField()
    total_ingestions = serializers.SerializerMethodField()

    class Meta:
        model = DataSource
        fields = ["id", "name", "display_name", "source_type", "is_active", "description",
                  "schedule_cron", "last_ingestion", "total_ingestions", "created_at"]

    def get_last_ingestion(self, obj):
        last = obj.ingestion_logs.filter(status="success").first()
        if last:
            return {"rows": last.rows_loaded, "date": last.created_at, "duration": last.duration_seconds}
        return None

    def get_total_ingestions(self, obj):
        return obj.ingestion_logs.count()


class IngestionLogSerializer(serializers.ModelSerializer):
    source_name = serializers.CharField(source="source.display_name", read_only=True)
    duration_seconds = serializers.ReadOnlyField()

    class Meta:
        model = IngestionLog
        fields = ["id", "source_name", "status", "layer", "rows_loaded",
                  "file_path", "file_size_bytes", "duration_seconds", "created_at"]


class CatalogEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = CatalogEntry
        fields = ["id", "table_name", "layer", "display_name", "description",
                  "columns", "row_count", "file_size_bytes", "profile", "updated_at"]


class QuerySessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuerySession
        fields = ["id", "user_question", "generated_sql", "result_preview",
                  "result_columns", "row_count", "execution_time_ms",
                  "tokens_used", "chart_type", "error_message",
                  "llm_provider", "llm_model", "created_at"]


class QueryCreateSerializer(serializers.Serializer):
    question = serializers.CharField(help_text="Pergunta em linguagem natural.")
    provider = serializers.CharField(required=False, default=None, allow_null=True,
                                     help_text="Provider de LLM: 'anthropic' ou 'ollama'.")
    model = serializers.CharField(required=False, default=None, allow_null=True,
                                  help_text="Modelo específico do provider (ex: llama3, claude-sonnet-4-20250514).")


class DbtRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = DbtRun
        fields = ["id", "command", "status", "models_run", "started_at",
                  "ended_at", "output_log", "error_message", "created_at"]


class FileUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
    name = serializers.CharField(help_text="Nome da fonte (slug)")
    display_name = serializers.CharField(required=False, default="")
