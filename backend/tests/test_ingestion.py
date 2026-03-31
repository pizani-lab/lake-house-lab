"""
Testes unitários para lakehouse.ingestion.engine.
"""
from pathlib import Path

import pandas as pd
import pytest

from lakehouse.ingestion.engine import (
    ingest_api,
    ingest_csv,
    ingest_json,
    ingest_url,
    run_ingestion,
    save_to_bronze,
)


# ──────────────────────────────────────────────
# ingest_csv
# ──────────────────────────────────────────────


def test_ingest_csv_from_content(csv_content):
    df = ingest_csv({"content": csv_content})
    assert isinstance(df, pd.DataFrame)
    assert len(df) == 3
    assert list(df.columns) == ["nome", "cargo", "salario"]


def test_ingest_csv_from_file(tmp_path, csv_content):
    p = tmp_path / "dados.csv"
    p.write_text(csv_content)
    df = ingest_csv({"file_path": str(p)})
    assert len(df) == 3


def test_ingest_csv_sem_config_levanta_erro():
    with pytest.raises(ValueError, match="CSV config precisa"):
        ingest_csv({})


# ──────────────────────────────────────────────
# ingest_json
# ──────────────────────────────────────────────


def test_ingest_json_from_content(json_content):
    df = ingest_json({"content": json_content})
    assert isinstance(df, pd.DataFrame)
    assert len(df) == 2
    assert "sigla" in df.columns


def test_ingest_json_from_file(tmp_path, json_content):
    p = tmp_path / "dados.json"
    p.write_text(json_content)
    df = ingest_json({"file_path": str(p)})
    assert len(df) == 2


def test_ingest_json_sem_config_levanta_erro():
    with pytest.raises(ValueError, match="JSON config precisa"):
        ingest_json({})


# ──────────────────────────────────────────────
# ingest_api
# ──────────────────────────────────────────────


def test_ingest_api_lista(mocker):
    """Resposta JSON que é uma lista → DataFrame direto."""
    mock_resp = mocker.MagicMock()
    mock_resp.json.return_value = [{"id": 1, "nome": "SP"}, {"id": 2, "nome": "RJ"}]
    mock_resp.raise_for_status.return_value = None
    mocker.patch("httpx.get", return_value=mock_resp)

    df = ingest_api({"url": "https://example.com/api"})
    assert len(df) == 2
    assert "id" in df.columns


def test_ingest_api_json_path(mocker):
    """Resposta com wrapper → json_path navega até o array."""
    mock_resp = mocker.MagicMock()
    mock_resp.json.return_value = {"data": {"results": [{"id": 1}]}}
    mock_resp.raise_for_status.return_value = None
    mocker.patch("httpx.get", return_value=mock_resp)

    df = ingest_api({"url": "https://example.com/api", "json_path": "data.results"})
    assert len(df) == 1


def test_ingest_api_dict_vira_single_row(mocker):
    mock_resp = mocker.MagicMock()
    mock_resp.json.return_value = {"chave": "valor"}
    mock_resp.raise_for_status.return_value = None
    mocker.patch("httpx.get", return_value=mock_resp)

    df = ingest_api({"url": "https://example.com/api"})
    assert len(df) == 1


# ──────────────────────────────────────────────
# ingest_url
# ──────────────────────────────────────────────


def test_ingest_url_csv(mocker, tmp_path, csv_content):
    csv_file = tmp_path / "dados.csv"
    csv_file.write_text(csv_content)
    df = ingest_url({"url": str(csv_file)})
    assert len(df) == 3


def test_ingest_url_json(mocker, tmp_path, json_content):
    json_file = tmp_path / "dados.json"
    json_file.write_text(json_content)
    df = ingest_url({"url": str(json_file)})
    assert len(df) == 2


# ──────────────────────────────────────────────
# save_to_bronze
# ──────────────────────────────────────────────


def test_save_to_bronze_cria_parquet(tmp_bronze_dir, sample_df):
    file_path, file_size = save_to_bronze(sample_df, "test-source")

    assert Path(file_path).exists()
    assert file_size > 0

    df_lido = pd.read_parquet(file_path)
    assert len(df_lido) == len(sample_df)
    assert list(df_lido.columns) == list(sample_df.columns)


def test_save_to_bronze_cria_subdir_por_fonte(tmp_bronze_dir, sample_df):
    save_to_bronze(sample_df, "ibge-cities")
    source_dir = tmp_bronze_dir / "ibge-cities"
    assert source_dir.exists()
    assert len(list(source_dir.glob("*.parquet"))) == 1


# ──────────────────────────────────────────────
# run_ingestion
# ──────────────────────────────────────────────


def test_run_ingestion_csv_completo(tmp_bronze_dir, csv_content):
    result = run_ingestion("emp-test", "csv_upload", {"content": csv_content})

    assert result["rows_loaded"] == 3
    assert Path(result["file_path"]).exists()
    assert result["file_size_bytes"] > 0
    assert "nome" in result["columns"]
    assert "salario" in result["dtypes"]


def test_run_ingestion_tipo_invalido():
    with pytest.raises(ValueError, match="Ingestor não encontrado"):
        run_ingestion("x", "tipo_inexistente", {})
