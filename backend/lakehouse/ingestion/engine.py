"""
LakeHouse Lab — Ingestion Engine

Conectores que ingerem dados de diferentes fontes e salvam em Parquet na camada bronze.
Cada ingestor retorna um DataFrame pandas que é persistido em Parquet com partição por data.
"""
import io
import logging
from datetime import date
from pathlib import Path

import httpx
import pandas as pd
from django.conf import settings

logger = logging.getLogger(__name__)


def ingest_api(config: dict) -> pd.DataFrame:
    """Ingere dados de uma API REST."""
    url = config["url"]
    params = config.get("params", {})
    headers = config.get("headers", {})
    json_path = config.get("json_path", None)  # Ex: "data.results"

    response = httpx.get(url, params=params, headers=headers, timeout=30)
    response.raise_for_status()
    data = response.json()

    # Navega até o array de dados se json_path especificado
    if json_path:
        for key in json_path.split("."):
            data = data[key] if isinstance(data, dict) else data
    
    if isinstance(data, list):
        return pd.DataFrame(data)
    elif isinstance(data, dict):
        return pd.DataFrame([data])
    else:
        raise ValueError(f"Formato inesperado: {type(data)}")


def ingest_csv(config: dict) -> pd.DataFrame:
    """Ingere dados de um CSV (upload ou URL)."""
    if "content" in config:
        return pd.read_csv(io.StringIO(config["content"]))
    elif "file_path" in config:
        return pd.read_csv(config["file_path"])
    elif "url" in config:
        return pd.read_csv(config["url"])
    raise ValueError("CSV config precisa de 'content', 'file_path' ou 'url'.")


def ingest_json(config: dict) -> pd.DataFrame:
    """Ingere dados de um JSON (upload ou URL)."""
    if "content" in config:
        return pd.read_json(io.StringIO(config["content"]))
    elif "file_path" in config:
        return pd.read_json(config["file_path"])
    elif "url" in config:
        return pd.read_json(config["url"])
    raise ValueError("JSON config precisa de 'content', 'file_path' ou 'url'.")


def ingest_url(config: dict) -> pd.DataFrame:
    """Ingere dados de uma URL (auto-detecta formato)."""
    url = config["url"]
    if url.endswith(".csv"):
        return pd.read_csv(url)
    elif url.endswith(".json"):
        return pd.read_json(url)
    elif url.endswith(".parquet"):
        return pd.read_parquet(url)
    # Tenta JSON por padrão
    return ingest_api(config)


# Registry de ingestores
INGESTORS = {
    "api": ingest_api,
    "csv": ingest_csv,        # alias para fontes cadastradas com file_path
    "csv_upload": ingest_csv,
    "json": ingest_json,      # alias para fontes cadastradas com file_path
    "json_upload": ingest_json,
    "url": ingest_url,
}


def save_to_bronze(df: pd.DataFrame, source_name: str) -> tuple[str, int]:
    """
    Salva DataFrame na camada bronze como Parquet.

    Retorna:
        (file_path, file_size_bytes)
    """
    source_dir = settings.BRONZE_DIR / source_name
    source_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{date.today().isoformat()}.parquet"
    file_path = source_dir / filename

    df.to_parquet(file_path, engine="pyarrow", index=False)

    file_size = file_path.stat().st_size
    logger.info(f"Bronze: {source_name} → {len(df)} rows, {file_size} bytes → {file_path}")

    return str(file_path), file_size


def run_ingestion(source_name: str, source_type: str, config: dict) -> dict:
    """
    Executa ingestão completa: fonte → DataFrame → Parquet bronze.

    Returns:
        Dict com rows_loaded, file_path, file_size_bytes.
    """
    ingestor = INGESTORS.get(source_type)
    if not ingestor:
        raise ValueError(f"Ingestor não encontrado para tipo: {source_type}")

    df = ingestor(config)
    file_path, file_size = save_to_bronze(df, source_name)

    return {
        "rows_loaded": len(df),
        "file_path": file_path,
        "file_size_bytes": file_size,
        "columns": list(df.columns),
        "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
    }
