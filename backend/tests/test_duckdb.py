"""
Testes unitários para lakehouse.catalog.duckdb_connector.
"""
import pandas as pd
import pytest

from lakehouse.catalog.duckdb_connector import (
    execute_sql,
    get_table_schema,
    list_tables,
    profile_table,
)


# ──────────────────────────────────────────────
# execute_sql
# ──────────────────────────────────────────────


def test_execute_sql_literal(tmp_lakehouse):
    result = execute_sql("SELECT 42 AS n")
    assert result["columns"] == ["n"]
    assert result["rows"] == [[42]]
    assert result["row_count"] == 1
    assert "error" not in result


def test_execute_sql_parquet_direto(bronze_parquet):
    result = execute_sql(f"SELECT * FROM read_parquet('{bronze_parquet}')")
    assert result["columns"] == ["id", "name", "value"]
    assert result["row_count"] == 3


def test_execute_sql_view_auto_registrada(bronze_parquet):
    """DuckDB deve auto-registrar view 'bronze_employees' para o Parquet."""
    result = execute_sql("SELECT COUNT(*) AS total FROM bronze_employees")
    assert result["rows"][0][0] == 3


def test_execute_sql_erro_retorna_dict(tmp_lakehouse):
    result = execute_sql("SELECT * FROM tabela_que_nao_existe")
    assert "error" in result
    assert result["columns"] == []
    assert result["rows"] == []


def test_execute_sql_respeita_limit(bronze_parquet):
    result = execute_sql("SELECT * FROM bronze_employees", limit=2)
    assert len(result["rows"]) == 2


# ──────────────────────────────────────────────
# list_tables
# ──────────────────────────────────────────────


def test_list_tables_retorna_lista(tmp_lakehouse):
    tables = list_tables()
    assert isinstance(tables, list)


def test_list_tables_inclui_view_bronze(bronze_parquet):
    tables = list_tables()
    names = [t["name"] for t in tables]
    assert "bronze_employees" in names


# ──────────────────────────────────────────────
# get_table_schema
# ──────────────────────────────────────────────


def test_get_table_schema_retorna_colunas(bronze_parquet):
    schema = get_table_schema("bronze_employees")
    assert len(schema) == 3
    col_names = [c["name"] for c in schema]
    assert "id" in col_names
    assert "name" in col_names
    assert "value" in col_names


def test_get_table_schema_tem_dtype(bronze_parquet):
    schema = get_table_schema("bronze_employees")
    for col in schema:
        assert "dtype" in col
        assert col["dtype"] != ""


# ──────────────────────────────────────────────
# profile_table
# ──────────────────────────────────────────────


def test_profile_table_row_count(bronze_parquet):
    profile = profile_table("bronze_employees")
    assert profile["row_count"] == 3


def test_profile_table_colunas_completas(bronze_parquet):
    profile = profile_table("bronze_employees")
    assert profile["column_count"] == 3
    assert len(profile["columns"]) == 3


def test_profile_table_stats_presentes(bronze_parquet):
    profile = profile_table("bronze_employees")
    col = next(c for c in profile["columns"] if c["name"] == "value")
    assert "null_count" in col
    assert "distinct_count" in col
    assert col["null_count"] == 0
    assert col["distinct_count"] == 3
