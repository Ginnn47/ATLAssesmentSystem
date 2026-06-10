from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("atl", "0006_rename_exchanging_information_subskill"),
    ]

    operations = [
        migrations.AddField(
            model_name="topic",
            name="is_active",
            field=models.BooleanField(default=True),
        ),
    ]
