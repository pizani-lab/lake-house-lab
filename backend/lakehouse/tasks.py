"""
LakeHouse Lab — Celery Tasks
"""
import logging
from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=2)
def run_ingestion_task(self, source_id: str, config_override: dict = None):
    """Executa ingestão de uma fonte e salva na camada bronze."""
    from lakehouse.ingestion.engine import run_ingestion
    from lakehouse.models import DataSource, IngestionLog

    source = DataSource.objects.get(id=source_id)
    log = IngestionLog.objects.create(source=source, status=IngestionLog.Status.RUNNING, started_at=timezone.now())

    try:
        config = config_override or source.config
        result = run_ingestion(source.name, source.source_type, config)

        log.status = IngestionLog.Status.SUCCESS
        log.rows_loaded = result["rows_loaded"]
        log.file_path = result["file_path"]
        log.file_size_bytes = result["file_size_bytes"]
        log.ended_at = timezone.now()
        log.save()

        # Atualiza schema detectado na fonte
        source.config["detected_columns"] = result.get("columns", [])
        source.config["detected_dtypes"] = result.get("dtypes", {})
        source.save(update_fields=["config"])

        logger.info(f"Ingestão {source.name}: {result['rows_loaded']} rows → {result['file_path']}")
        return {"status": "success", "rows": result["rows_loaded"]}

    except Exception as exc:
        log.status = IngestionLog.Status.FAILED
        log.error_message = str(exc)[:2000]
        log.ended_at = timezone.now()
        log.save()
        logger.error(f"Ingestão {source.name} falhou: {exc}")
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc)
        return {"status": "failed", "error": str(exc)}


@shared_task(bind=True)
def run_dbt_task(self, command: str = "run", select: str = ""):
    """Executa dbt e registra resultado."""
    from lakehouse.dbt_runner.engine import run_dbt
    from lakehouse.models import DbtRun

    dbt_run = DbtRun.objects.create(command=f"dbt {command}", status=DbtRun.Status.RUNNING, started_at=timezone.now())

    try:
        result = run_dbt(command=command, select=select)

        dbt_run.status = DbtRun.Status.SUCCESS if result["success"] else DbtRun.Status.FAILED
        dbt_run.models_run = result["models_run"]
        dbt_run.output_log = result["output"]
        dbt_run.error_message = "" if result["success"] else result["output"][-500:]
        dbt_run.ended_at = timezone.now()
        dbt_run.save()

        return {"status": "success" if result["success"] else "failed", "models": result["models_run"]}

    except Exception as exc:
        dbt_run.status = DbtRun.Status.FAILED
        dbt_run.error_message = str(exc)[:2000]
        dbt_run.ended_at = timezone.now()
        dbt_run.save()
        return {"status": "failed", "error": str(exc)}
