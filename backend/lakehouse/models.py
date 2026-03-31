"""
LakeHouse Lab — Domain Models

Metadata sobre fontes, ingestões, catálogo e queries.
Os dados em si vivem em Parquet/DuckDB, não no PostgreSQL.
"""
import uuid
from django.db import models


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


# ──────────────────────────────────────────────
# Data Sources
# ──────────────────────────────────────────────


class DataSource(TimeStampedModel):
    """Configuração de uma fonte de dados para ingestão."""

    class SourceType(models.TextChoices):
        API = "api", "API REST"
        CSV_UPLOAD = "csv_upload", "Upload CSV"
        JSON_UPLOAD = "json_upload", "Upload JSON"
        URL = "url", "URL direta"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200, unique=True, help_text="Slug da fonte (ex: ibge-cities)")
    display_name = models.CharField(max_length=200)
    source_type = models.CharField(max_length=20, choices=SourceType.choices)
    config = models.JSONField(default=dict, help_text="URL, headers, params, file_path, etc.")
    schedule_cron = models.CharField(max_length=100, blank=True)
    is_active = models.BooleanField(default=True)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.display_name


class IngestionLog(TimeStampedModel):
    """Registro de cada ingestão executada."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pendente"
        RUNNING = "running", "Executando"
        SUCCESS = "success", "Sucesso"
        FAILED = "failed", "Falhou"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    source = models.ForeignKey(DataSource, on_delete=models.CASCADE, related_name="ingestion_logs")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    layer = models.CharField(max_length=10, default="bronze", help_text="Camada destino (bronze)")
    rows_loaded = models.IntegerField(default=0)
    file_path = models.CharField(max_length=500, blank=True, help_text="Caminho do Parquet gerado")
    file_size_bytes = models.BigIntegerField(default=0)
    started_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.source.name} → {self.status} ({self.rows_loaded} rows)"

    @property
    def duration_seconds(self):
        if self.started_at and self.ended_at:
            return (self.ended_at - self.started_at).total_seconds()
        return None


# ──────────────────────────────────────────────
# Data Catalog
# ──────────────────────────────────────────────


class CatalogEntry(TimeStampedModel):
    """Entrada no catálogo de dados — uma tabela/view no lakehouse."""

    class Layer(models.TextChoices):
        BRONZE = "bronze", "Bronze"
        SILVER = "silver", "Silver"
        GOLD = "gold", "Gold"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    table_name = models.CharField(max_length=200, unique=True)
    layer = models.CharField(max_length=10, choices=Layer.choices)
    display_name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    file_path = models.CharField(max_length=500, help_text="Caminho do Parquet/view")
    columns = models.JSONField(default=list, help_text="Schema: [{name, dtype, nullable, description}]")
    row_count = models.BigIntegerField(default=0)
    file_size_bytes = models.BigIntegerField(default=0)
    source = models.ForeignKey(DataSource, null=True, blank=True, on_delete=models.SET_NULL, related_name="catalog_entries")
    profile = models.JSONField(default=dict, blank=True, help_text="Profiling: null_pct, unique, min, max por coluna")

    class Meta:
        ordering = ["layer", "table_name"]
        verbose_name_plural = "Catalog entries"

    def __str__(self):
        return f"[{self.layer}] {self.table_name}"


# ──────────────────────────────────────────────
# Query Agent
# ──────────────────────────────────────────────


class QuerySession(TimeStampedModel):
    """Uma consulta feita pelo agente text-to-SQL."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_question = models.TextField(help_text="Pergunta em linguagem natural.")
    generated_sql = models.TextField(blank=True, help_text="SQL gerado pelo agente.")
    result_preview = models.JSONField(default=list, help_text="Primeiras N linhas do resultado.")
    result_columns = models.JSONField(default=list, help_text="Nomes das colunas do resultado.")
    row_count = models.IntegerField(default=0)
    execution_time_ms = models.IntegerField(default=0)
    tokens_used = models.IntegerField(default=0)
    error_message = models.TextField(blank=True)
    chart_type = models.CharField(max_length=20, blank=True, help_text="Tipo de gráfico sugerido pelo agente (bar, line, pie)")
    llm_provider = models.CharField(max_length=50, blank=True, default="", help_text="Provider usado (anthropic, ollama, etc.)")
    llm_model = models.CharField(max_length=100, blank=True, default="", help_text="Modelo usado pelo provider.")

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Q: {self.user_question[:80]}..."


# ──────────────────────────────────────────────
# dbt Runs
# ──────────────────────────────────────────────


class DbtRun(TimeStampedModel):
    """Registro de execução do dbt."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pendente"
        RUNNING = "running", "Executando"
        SUCCESS = "success", "Sucesso"
        FAILED = "failed", "Falhou"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    command = models.CharField(max_length=100, default="dbt run")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    models_run = models.IntegerField(default=0)
    started_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    output_log = models.TextField(blank=True)
    error_message = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"dbt run — {self.status} ({self.models_run} models)"
