from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import (
    CatalogViewSet, DataSourceViewSet, DbtLineageView, DbtModelsView, DbtRunView,
    IngestionLogViewSet, QueryHistoryView, QueryView,
)

router = DefaultRouter()
router.register(r"sources", DataSourceViewSet, basename="source")
router.register(r"ingestions", IngestionLogViewSet, basename="ingestion")
router.register(r"catalog", CatalogViewSet, basename="catalog")

app_name = "api"

urlpatterns = [
    path("", include(router.urls)),
    path("query/", QueryView.as_view(), name="query"),
    path("query/history/", QueryHistoryView.as_view(), name="query-history"),
    path("dbt/run/", DbtRunView.as_view(), name="dbt-run"),
    path("dbt/models/", DbtModelsView.as_view(), name="dbt-models"),
    path("dbt/lineage/", DbtLineageView.as_view(), name="dbt-lineage"),
]
