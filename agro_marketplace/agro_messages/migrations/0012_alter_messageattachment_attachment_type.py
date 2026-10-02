from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        (
            "agro_messages",
            "0011_alter_messageattachment_file",
        ),
    ]

    operations = [
        migrations.AlterField(
            model_name="messageattachment",
            name="attachment_type",
            field=models.CharField(
                choices=[
                    ("image", "Image"),
                    ("video", "Video"),
                    ("audio", "Audio"),
                    ("file", "File"),
                ],
                max_length=10,
            ),
        ),
    ]
