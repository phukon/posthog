# Generated by Django 4.2.14 on 2024-07-24 11:20

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("posthog", "0450_externaldataschema_sync_frequency_interval_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="datawarehousetable",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, null=True, blank=True),
        ),
        migrations.AddField(
            model_name="externaldatajob",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, null=True, blank=True),
        ),
        migrations.AddField(
            model_name="externaldataschema",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, null=True, blank=True),
        ),
        migrations.AddField(
            model_name="externaldatasource",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, null=True, blank=True),
        ),
    ]
