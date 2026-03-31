"""
LakeHouse Lab — dbt Runner

Executa comandos dbt a partir do Django/Celery.
"""
import logging
import subprocess

from django.conf import settings

logger = logging.getLogger(__name__)


def run_dbt(command: str = "run", select: str = "") -> dict:
    """
    Executa um comando dbt.

    Args:
        command: run, build, test, compile, etc.
        select: seletor de modelos (ex: staging, +marts)

    Returns:
        Dict com success, output, models_run.
    """
    cmd = [
        "dbt", command,
        "--project-dir", settings.DBT_PROJECT_DIR,
        "--profiles-dir", settings.DBT_PROFILES_DIR,
    ]

    if select:
        cmd.extend(["--select", select])

    logger.info(f"Executando: {' '.join(cmd)}")

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300,
            cwd=settings.DBT_PROJECT_DIR,
        )

        output = result.stdout + result.stderr
        success = result.returncode == 0

        # Conta modelos executados
        models_run = output.count("OK created") + output.count("OK modified")

        logger.info(f"dbt {command}: {'OK' if success else 'FAILED'} — {models_run} models")

        return {
            "success": success,
            "output": output[-5000:],  # Últimos 5k chars
            "models_run": models_run,
            "return_code": result.returncode,
        }

    except subprocess.TimeoutExpired:
        return {"success": False, "output": "Timeout (300s)", "models_run": 0, "return_code": -1}
    except Exception as e:
        return {"success": False, "output": str(e), "models_run": 0, "return_code": -1}
