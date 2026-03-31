"""
LakeHouse Lab — DuckDB Connector

Engine analítica que lê Parquet direto das camadas bronze/silver/gold.
Fornece: execução de SQL, discovery de tabelas, profiling.
"""
import logging
from pathlib import Path

import duckdb
from django.conf import settings

logger = logging.getLogger(__name__)


def get_connection() -> duckdb.DuckDBPyConnection:
    """Cria conexão DuckDB com views para as camadas do lakehouse."""
    conn = duckdb.connect(settings.DUCKDB_PATH)
    _register_parquet_views(conn)
    return conn


def _register_parquet_views(conn: duckdb.DuckDBPyConnection):
    """Registra views para cada Parquet encontrado nas camadas."""
    for layer in ["bronze", "silver", "gold"]:
        layer_dir = getattr(settings, f"{layer.upper()}_DIR")
        if not layer_dir.exists():
            continue

        for parquet_file in Path(layer_dir).rglob("*.parquet"):
            # Gera nome da view: layer_sourcename (ex: bronze_ibge_cities)
            relative = parquet_file.relative_to(layer_dir)
            parts = list(relative.parts)
            stem = parts[-1].replace(".parquet", "").replace("-", "_")

            if len(parts) > 1:
                view_name = f"{layer}_{parts[0].replace('-', '_')}"
            else:
                view_name = f"{layer}_{stem}"

            try:
                conn.execute(
                    f"CREATE OR REPLACE VIEW {view_name} AS "
                    f"SELECT * FROM read_parquet('{parquet_file}')"
                )
            except Exception as e:
                logger.warning(f"Falha ao registrar view {view_name}: {e}")


def execute_sql(sql: str, limit: int = 100) -> dict:
    """
    Executa SQL no DuckDB e retorna resultado.

    Returns:
        Dict com columns, rows, row_count, execution_time_ms.
    """
    import time
    conn = get_connection()

    start = time.perf_counter()
    try:
        result = conn.execute(sql)
        columns = [desc[0] for desc in result.description]
        rows = result.fetchmany(limit)
        total_count = len(rows)

        # Tenta contar total se tem mais que o limit
        if total_count == limit:
            try:
                count_result = conn.execute(f"SELECT COUNT(*) FROM ({sql}) t")
                total_count = count_result.fetchone()[0]
            except Exception:
                pass

        execution_time_ms = int((time.perf_counter() - start) * 1000)

        # Converte para tipos serializáveis
        serializable_rows = []
        for row in rows:
            serializable_rows.append([
                str(v) if not isinstance(v, (int, float, str, bool, type(None))) else v
                for v in row
            ])

        return {
            "columns": columns,
            "rows": serializable_rows,
            "row_count": total_count,
            "execution_time_ms": execution_time_ms,
        }
    except Exception as e:
        execution_time_ms = int((time.perf_counter() - start) * 1000)
        return {
            "columns": [],
            "rows": [],
            "row_count": 0,
            "execution_time_ms": execution_time_ms,
            "error": str(e),
        }
    finally:
        conn.close()


def list_tables() -> list[dict]:
    """Lista todas as views/tabelas registradas no DuckDB."""
    conn = get_connection()
    try:
        result = conn.execute(
            "SELECT table_name, table_type FROM information_schema.tables "
            "WHERE table_schema = 'main' ORDER BY table_name"
        )
        return [{"name": row[0], "type": row[1]} for row in result.fetchall()]
    finally:
        conn.close()


def get_table_schema(table_name: str) -> list[dict]:
    """Retorna schema de uma tabela/view."""
    conn = get_connection()
    try:
        result = conn.execute(
            f"SELECT column_name, data_type, is_nullable "
            f"FROM information_schema.columns "
            f"WHERE table_name = '{table_name}' ORDER BY ordinal_position"
        )
        return [
            {"name": row[0], "dtype": row[1], "nullable": row[2] == "YES"}
            for row in result.fetchall()
        ]
    finally:
        conn.close()


def get_all_schemas() -> dict:
    """Retorna schema de todas as tabelas/views: {table_name: [col_name, ...]}."""
    conn = get_connection()
    try:
        tables = conn.execute(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'main' ORDER BY table_name"
        ).fetchall()
        result = {}
        for (table_name,) in tables:
            cols = conn.execute(
                "SELECT column_name FROM information_schema.columns "
                f"WHERE table_name = '{table_name}' ORDER BY ordinal_position"
            ).fetchall()
            result[table_name] = [c[0] for c in cols]
        return result
    finally:
        conn.close()


def profile_table(table_name: str) -> dict:
    """Profiling básico de uma tabela: count, nulls, unique, min/max."""
    conn = get_connection()
    try:
        # Row count
        count = conn.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]

        # Schema
        schema = get_table_schema(table_name)

        # Profile por coluna
        column_profiles = []
        for col in schema:
            col_name = col["name"]
            try:
                stats = conn.execute(f"""
                    SELECT 
                        COUNT(*) as total,
                        COUNT({col_name}) as non_null,
                        COUNT(DISTINCT {col_name}) as distinct_count,
                        MIN({col_name}::VARCHAR) as min_val,
                        MAX({col_name}::VARCHAR) as max_val
                    FROM {table_name}
                """).fetchone()

                column_profiles.append({
                    "name": col_name,
                    "dtype": col["dtype"],
                    "null_count": stats[0] - stats[1],
                    "null_pct": round((stats[0] - stats[1]) / stats[0] * 100, 2) if stats[0] else 0,
                    "distinct_count": stats[2],
                    "min": stats[3],
                    "max": stats[4],
                })
            except Exception:
                column_profiles.append({"name": col_name, "dtype": col["dtype"], "error": "profile failed"})

        return {
            "table_name": table_name,
            "row_count": count,
            "column_count": len(schema),
            "columns": column_profiles,
        }
    finally:
        conn.close()
