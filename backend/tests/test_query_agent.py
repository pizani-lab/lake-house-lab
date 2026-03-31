"""
Testes unitários para lakehouse.query_agent.engine.
"""
import json

import pytest

from lakehouse.llm.providers import LLMResponse


# ──────────────────────────────────────────────
# ask()
# ──────────────────────────────────────────────


def _mock_provider(mocker, sql: str, explanation: str = "Explicação", chart_type: str = "table"):
    """Configura mock do LLMProvider para retornar resposta JSON válida."""
    content = json.dumps({"sql": sql, "explanation": explanation, "chart_type": chart_type})
    mock_response = LLMResponse(content=content, input_tokens=100, output_tokens=50)

    mock_provider = mocker.MagicMock()
    mock_provider.generate.return_value = mock_response

    mocker.patch(
        "lakehouse.query_agent.engine.get_llm_provider",
        return_value=mock_provider,
    )
    return mock_provider


def test_ask_retorna_estrutura_completa(bronze_parquet, mocker):
    """ask() deve retornar sql, explanation, chart_type, columns, rows, tokens_used."""
    _mock_provider(mocker, "SELECT id, name FROM bronze_employees LIMIT 10")

    from lakehouse.query_agent.engine import ask

    result = ask("Mostre id e nome dos funcionários")

    assert "sql" in result
    assert "explanation" in result
    assert "chart_type" in result
    assert "columns" in result
    assert "rows" in result
    assert result["tokens_used"] == 150


def test_ask_executa_sql_no_duckdb(bronze_parquet, mocker):
    """ask() deve executar o SQL gerado e retornar rows reais."""
    _mock_provider(mocker, "SELECT * FROM bronze_employees")

    from lakehouse.query_agent.engine import ask

    result = ask("Liste todos os funcionários")

    assert result["row_count"] == 3
    assert "name" in result["columns"]
    assert result["error"] == ""


def test_ask_sql_vazio_nao_executa(tmp_lakehouse, mocker):
    """Se o LLM retornar sql vazio, ask() não tenta executar."""
    _mock_provider(mocker, "", "Não consigo responder", "none")

    from lakehouse.query_agent.engine import ask

    result = ask("Pergunta sem sentido")

    assert result["sql"] == ""
    assert result["rows"] == []
    assert result["chart_type"] == "none"


def test_ask_json_invalido_retorna_erro(tmp_lakehouse, mocker):
    """Se o LLM retornar texto inválido (não-JSON), ask() retorna erro graciosamente."""
    mock_response = LLMResponse(content="Não sei responder isso.", input_tokens=80, output_tokens=20)
    mock_provider = mocker.MagicMock()
    mock_provider.generate.return_value = mock_response
    mocker.patch(
        "lakehouse.query_agent.engine.get_llm_provider",
        return_value=mock_provider,
    )

    from lakehouse.query_agent.engine import ask

    result = ask("Texto que gera resposta inválida")

    assert result["sql"] == ""
    assert "error" in result


def test_ask_markdown_json_e_parseado(bronze_parquet, mocker):
    """ask() deve remover delimitadores ```json ... ``` antes de parsear."""
    sql = "SELECT COUNT(*) AS total FROM bronze_employees"
    raw_text = f"```json\n{json.dumps({'sql': sql, 'explanation': 'Conta linhas', 'chart_type': 'none'})}\n```"

    mock_response = LLMResponse(content=raw_text, input_tokens=90, output_tokens=30)
    mock_provider = mocker.MagicMock()
    mock_provider.generate.return_value = mock_response
    mocker.patch(
        "lakehouse.query_agent.engine.get_llm_provider",
        return_value=mock_provider,
    )

    from lakehouse.query_agent.engine import ask

    result = ask("Quantas linhas tem?")
    assert result["sql"] == sql
