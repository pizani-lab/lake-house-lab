<div align="center">

# 🏠 LakeHouse Lab

**Data Lakehouse local com camadas bronze/silver/gold, transformações dbt, DuckDB como engine analítica e um agente text-to-SQL com suporte a Claude API e Ollama.**

[![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)](https://python.org)
[![Django](https://img.shields.io/badge/Django-5.1-092E20?logo=django&logoColor=white)](https://djangoproject.com)
[![dbt](https://img.shields.io/badge/dbt_Core-1.9-FF694B?logo=dbt&logoColor=white)](https://getdbt.com)
[![DuckDB](https://img.shields.io/badge/DuckDB-1.1-FEF000?logo=duckdb&logoColor=black)](https://duckdb.org)
[![Claude API](https://img.shields.io/badge/Claude_API-Text_to_SQL-D97757?logo=anthropic&logoColor=white)](https://docs.anthropic.com)
[![Ollama](https://img.shields.io/badge/Ollama-local_LLM-white?logo=ollama&logoColor=black)](https://ollama.ai)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[Arquitetura](#-arquitetura) • [Quick Start](#-quick-start) • [Camadas de Dados](#-camadas-de-dados) • [API Reference](#-api-reference) • [Roadmap](#-roadmap)

</div>

---

## 📌 Sobre

O **LakeHouse Lab** é um projeto de data engineering end-to-end que demonstra arquitetura de dados moderna em escala local:

- **Ingestão multi-fonte** — APIs públicas, CSV/JSON upload, drag-and-drop UI
- **Camadas bronze/silver/gold** — dados brutos → limpos → agregados em Parquet
- **Transformações dbt** — modelos declarativos com lineage visual
- **DuckDB** — engine analítica que lê Parquet direto sem ETL extra
- **Agente text-to-SQL** — Claude API ou Ollama local; autocomplete de tabelas/colunas
- **Catálogo de dados** — schema discovery automático com profiling

---

## 🏗 Arquitetura

```
  APIs / CSV / JSON
        │
  ┌─────▼──────┐
  │ Ingestores │  Django + Celery — conectores por tipo de fonte
  └─────┬──────┘
        │
  ┌─────▼──────┐
  │   Bronze   │  Parquet bruto — append-only, schema-on-read
  └─────┬──────┘
        │
  ┌─────▼──────┐
  │  dbt Core  │  staging → intermediate → marts
  └─────┬──────┘
        │
  ┌─────▼──────┐   ┌──────────┐
  │   Silver   │   │   Gold   │  Parquet limpo → agregado
  └─────┬──────┘   └────┬─────┘
        │               │
  ┌─────▼───────────────▼──┐
  │        DuckDB          │  Engine analítica — lê Parquet direto
  └─────────┬──────────────┘
            │
  ┌─────────▼──────────┐
  │ Agente Text-to-SQL │  Claude API — NL → SQL → resultado
  └─────────┬──────────┘
            │
  ┌─────────▼──────────┐
  │  React Dashboard   │  Query bar + tabela + gráfico automático
  └────────────────────┘
```

---

## 🚀 Quick Start

```bash
git clone https://github.com/pizanao/lake-house.git
cd lake-house
cp .env.example .env
# Edite .env com sua ANTHROPIC_API_KEY

docker compose up -d
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py seed_sources
docker compose exec backend python manage.py ingest --source brazil-cities
docker compose exec backend python manage.py run_dbt
```

| Serviço       | URL                           |
|---------------|-------------------------------|
| Dashboard     | http://localhost:5173          |
| API           | http://localhost:8000/api/     |
| Admin         | http://localhost:8000/admin/   |

---

## 📦 Camadas de Dados

| Camada | Formato | Conteúdo | Exemplo |
|--------|---------|----------|---------|
| **Bronze** | Parquet | Dados brutos, como vieram da fonte | `data/bronze/ibge_cities/2026-03-22.parquet` |
| **Silver** | Parquet | Dados limpos: tipos corretos, dedup, nulos tratados | `data/silver/stg_cities.parquet` |
| **Gold** | Parquet | Métricas agregadas, tabelas dimensionais | `data/gold/cities_by_state.parquet` |

---

## 📡 API Reference

### Fontes de Dados
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/sources/` | Listar fontes configuradas |
| POST | `/api/sources/{id}/ingest/` | Disparar ingestão |
| POST | `/api/sources/upload/` | Upload CSV/JSON |

### Catálogo
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/catalog/` | Listar tabelas no lakehouse |
| GET | `/api/catalog/discover/` | Descobrir views DuckDB |
| GET | `/api/catalog/schema/` | Schema completo (para autocomplete) |
| GET | `/api/catalog/{table}/profile/` | Profiling da tabela |

### Query Agent
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/query/` | Pergunta em linguagem natural → SQL → resultado |
| GET | `/api/query/history/` | Histórico de queries |

> O payload de `POST /api/query/` aceita `provider` (`anthropic` ou `ollama`) e `model` opcionais.

### dbt
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/dbt/run/` | Executar dbt run/build/test |
| GET | `/api/dbt/models/` | Listar execuções recentes |
| GET | `/api/dbt/lineage/` | Grafo de lineage do manifest.json |

---

## 🗺 Roadmap

- ✅ Ingestão multi-fonte (API + CSV + JSON + URL)
- ✅ Camadas bronze/silver/gold em Parquet
- ✅ Projeto dbt com staging/intermediate/marts
- ✅ DuckDB como engine analítica
- ✅ Agente text-to-SQL com Claude API
- ✅ Catálogo de dados com profiling automático
- ✅ Dashboard React com query bar e gráficos automáticos
- ✅ Suporte a múltiplos LLM providers (Anthropic + Ollama local)
- ✅ Seletor de provider/modelo por query no frontend
- ✅ Upload UI — drag-and-drop de CSV/JSON com ingestão automática
- ✅ Autocomplete de tabelas e colunas no Query Agent
- ✅ Lineage visual (DAG do dbt a partir do manifest.json)
- [ ] Scheduling de ingestão via Celery Beat
- [ ] Data quality checks automatizados (dbt tests + alertas)
- [ ] Export de resultados para CSV/Parquet/Excel
- [ ] Suporte a Excel e Google Sheets

---

## 📄 Licença

MIT

---

<div align="center">

Desenvolvido por **Daniel Pizani** · 2026

Django · dbt Core · DuckDB · Ollama · Claude API · React

</div>
