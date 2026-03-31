from django.contrib import admin
from .models import CatalogEntry, DataSource, DbtRun, IngestionLog, QuerySession

@admin.register(DataSource)
class DataSourceAdmin(admin.ModelAdmin):
    list_display = ["display_name", "source_type", "is_active", "created_at"]
    list_filter = ["source_type", "is_active"]

@admin.register(IngestionLog)
class IngestionLogAdmin(admin.ModelAdmin):
    list_display = ["source", "status", "rows_loaded", "file_size_bytes", "created_at"]
    list_filter = ["status"]

@admin.register(CatalogEntry)
class CatalogEntryAdmin(admin.ModelAdmin):
    list_display = ["table_name", "layer", "row_count", "file_size_bytes", "updated_at"]
    list_filter = ["layer"]

@admin.register(QuerySession)
class QuerySessionAdmin(admin.ModelAdmin):
    list_display = ["short_question", "row_count", "execution_time_ms", "tokens_used", "created_at"]
    def short_question(self, obj): return obj.user_question[:80]

@admin.register(DbtRun)
class DbtRunAdmin(admin.ModelAdmin):
    list_display = ["command", "status", "models_run", "created_at"]
    list_filter = ["status"]
