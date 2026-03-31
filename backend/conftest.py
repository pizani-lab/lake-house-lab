"""
Fixtures globais para testes do LakeHouse Lab.
"""
import json
from pathlib import Path

import pandas as pd
import pytest


@pytest.fixture
def sample_df() -> pd.DataFrame:
    """DataFrame simples para testes."""
    return pd.DataFrame(
        {"id": [1, 2, 3], "name": ["Ana", "Bruno", "Carla"], "value": [100.0, 200.0, 300.0]}
    )


@pytest.fixture
def csv_content() -> str:
    """Conteúdo CSV para testes de ingestão."""
    return "nome,cargo,salario\nAna,Engenheira,8500\nBruno,Gerente,12000\nCarla,Analista,6200"


@pytest.fixture
def json_content() -> str:
    """Conteúdo JSON para testes de ingestão."""
    return json.dumps([
        {"id": 11, "nome": "São Paulo", "sigla": "SP"},
        {"id": 12, "nome": "Rio de Janeiro", "sigla": "RJ"},
    ])


@pytest.fixture
def tmp_bronze_dir(tmp_path, settings):
    """Bronze dir temporário; faz patch nas settings Django."""
    bronze = tmp_path / "bronze"
    bronze.mkdir()
    settings.BRONZE_DIR = bronze
    settings.DATA_DIR = tmp_path
    return bronze


@pytest.fixture
def tmp_lakehouse(tmp_path, settings):
    """Ambiente lakehouse completo em diretório temporário."""
    for layer in ("bronze", "silver", "gold"):
        (tmp_path / layer).mkdir()

    settings.BRONZE_DIR = tmp_path / "bronze"
    settings.SILVER_DIR = tmp_path / "silver"
    settings.GOLD_DIR = tmp_path / "gold"
    settings.DUCKDB_PATH = str(tmp_path / "test.duckdb")
    return tmp_path


@pytest.fixture
def bronze_parquet(tmp_lakehouse, sample_df, settings):
    """Parquet na camada bronze; view = 'bronze_employees'."""
    source_dir = settings.BRONZE_DIR / "employees"
    source_dir.mkdir()
    path = source_dir / "2026-01-01.parquet"
    sample_df.to_parquet(path, engine="pyarrow", index=False)
    return path
