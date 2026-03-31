"""Seed data sources for development."""
from django.core.management.base import BaseCommand
from lakehouse.models import DataSource


class Command(BaseCommand):
    help = "Cria fontes de dados demo (APIs públicas do Brasil)."

    def handle(self, *args, **options):
        sources = [
            {
                "name": "ibge-states",
                "display_name": "IBGE — Estados do Brasil",
                "source_type": "api",
                "config": {
                    "url": "https://servicodados.ibge.gov.br/api/v1/localidades/estados",
                    "params": {"orderBy": "nome"},
                },
                "description": "Lista de todos os estados brasileiros com código, sigla e região.",
            },
            {
                "name": "ibge-cities",
                "display_name": "IBGE — Municípios do Brasil",
                "source_type": "api",
                "config": {
                    "url": "https://servicodados.ibge.gov.br/api/v1/localidades/municipios",
                    "params": {"orderBy": "nome"},
                },
                "description": "Lista completa dos 5.570 municípios brasileiros.",
            },
            {
                "name": "bcb-selic",
                "display_name": "BCB — Taxa Selic",
                "source_type": "api",
                "config": {
                    "url": "https://api.bcb.gov.br/dados/serie/bcdata.sgs.11/dados",
                    "params": {"formato": "json"},
                },
                "description": "Série histórica da taxa Selic do Banco Central.",
            },
            {
                "name": "sample-employees",
                "display_name": "Sample — Funcionários",
                "source_type": "csv",
                "config": {
                    "file_path": "data/seeds/employees_100.csv",
                },
                "description": "Dataset de exemplo com 100 funcionários distribuídos por estado.",
            },
        ]

        for src in sources:
            DataSource.objects.update_or_create(name=src["name"], defaults=src)

        self.stdout.write(self.style.SUCCESS(f"Criadas {len(sources)} fontes de dados."))
