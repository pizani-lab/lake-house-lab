"""
LakeHouse Lab — Query Agent (Text-to-SQL)

Traduz perguntas em linguagem natural para SQL usando um provider de LLM configurável.
Schema-aware: injeta schema das tabelas disponíveis no prompt.
"""
import json
import logging
import time

from django.conf import settings

# from backend.lakehouse.catalog.duckdb_connector import list_tables

from lakehouse.catalog.duckdb_connector import execute_sql, list_tables, get_table_schema
from lakehouse.llm.providers import get_llm_provider

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Você é um analista de dados especialista em SQL (DuckDB).

O usuário vai fazer perguntas em linguagem natural sobre os dados disponíveis no lakehouse.
Seu trabalho: gerar SQL DuckDB correto que responde à pergunta.

## Regras

1. Responda APENAS com JSON válido no formato:
{
  "sql": "SELECT ...",
  "explanation": "Explicação breve do que o SQL faz.",
  "chart_type": "bar|line|pie|table|none"
}

2. Use apenas as tabelas e colunas listadas no schema fornecido.
3. Sempre adicione LIMIT 100 se não houver GROUP BY/agregação.
4. Use aliases legíveis (ex: AS total_vendas, AS cidade).
5. Para datas, use funções DuckDB (strftime, date_trunc, etc.).
6. Sugira chart_type baseado no tipo de resultado:
   - bar: comparações entre categorias
   - line: séries temporais
   - pie: proporções/percentuais
   - table: dados tabulares sem agregação
   - none: contagem única ou valor escalar
7. Se não souber responder, retorne sql vazio e explique no explanation.
"""


def _build_schema_context() -> str:
    """Constrói contexto de schema para o agente."""
    tables = list_tables()
    if not tables:
        return "Nenhuma tabela disponível no lakehouse."

    context = "## Tabelas disponíveis\n\n"
    for table in tables:
        name = table["name"]
        schema = get_table_schema(name)
        if not schema:
            continue
        
        columns_str = ", ".join(f"{c['name']} ({c['dtype']})" for c in schema)
        context += f"**{name}**: {columns_str}\n\n"

    return context


def ask(
    question: str,
    provider: str | None = None,
    model: str | None = None,
) -> dict:
    """
    Recebe pergunta em linguagem natural, retorna SQL + resultado.

    Args:
        question: Pergunta em linguagem natural.
        provider: Provider de LLM ("anthropic", "ollama"). Usa configuração padrão se omitido.
        model: Modelo específico do provider. Usa configuração padrão se omitido.

    Returns:
        Dict com sql, explanation, chart_type, columns, rows, row_count,
        tokens_used, llm_provider, llm_model.
    """
    resolved_provider = provider or getattr(settings, "LLM_PROVIDER", "anthropic")
    llm = get_llm_provider(provider=provider, model=model)

    # O modelo efetivamente usado fica no atributo interno do provider
    resolved_model = model or (
        settings.ANTHROPIC_MODEL if resolved_provider == "anthropic" else settings.OLLAMA_MODEL
    )

    schema_context = _build_schema_context()

    user_message = f"""{schema_context}

## Pergunta do usuário

{question}

Responda APENAS com JSON válido."""

    start = time.perf_counter()

    response = llm.generate(
        system_prompt=SYSTEM_PROMPT,
        user_message=user_message,
        max_tokens=1024,
    )

    tokens_used = response.input_tokens + response.output_tokens

    # Parse do JSON
    content = response.content.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1].rsplit("```", 1)[0]

    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        return {
            "sql": "",
            "explanation": "Não consegui gerar SQL para essa pergunta.",
            "chart_type": "none",
            "columns": [],
            "rows": [],
            "row_count": 0,
            "execution_time_ms": 0,
            "tokens_used": tokens_used,
            "llm_provider": resolved_provider,
            "llm_model": resolved_model,
            "error": "JSON parse error",
        }

    sql = parsed.get("sql", "")
    explanation = parsed.get("explanation", "")
    chart_type = parsed.get("chart_type", "table")

    if not sql:
        return {
            "sql": "",
            "explanation": explanation or "Sem SQL gerado.",
            "chart_type": "none",
            "columns": [],
            "rows": [],
            "row_count": 0,
            "execution_time_ms": 0,
            "tokens_used": tokens_used,
            "llm_provider": resolved_provider,
            "llm_model": resolved_model,
        }

    # Executa SQL no DuckDB
    result = execute_sql(sql)

    total_time_ms = int((time.perf_counter() - start) * 1000)

    return {
        "sql": sql,
        "explanation": explanation,
        "chart_type": chart_type,
        "columns": result.get("columns", []),
        "rows": result.get("rows", []),
        "row_count": result.get("row_count", 0),
        "execution_time_ms": total_time_ms,
        "tokens_used": tokens_used,
        "llm_provider": resolved_provider,
        "llm_model": resolved_model,
        "error": result.get("error", ""),
    }
