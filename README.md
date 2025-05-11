# 🌾 Agro Marketplace — Demo Django Project

**Live Demo:** [https://agro-marketplace-app.azurewebsites.net/](https://agro-marketplace-app.azurewebsites.net/)

## 📋 Project Overview

This is my first Django project — a demo application deployed to Azure. The goal of the project is to create an **online marketplace** for agricultural products, where **buyers and sellers can connect** directly.

### 🔑 Key Features

* ✅ User authentication with custom user model
* 🛒 Sellers can post ads for agricultural products
* 🛍️ Buyers can browse and respond to product ads
* 💬 Built-in messaging system for communication between users
* 👤 User profiles with the ability to:
  * Edit profile details
  * Manage ads (activate/deactivate, delete)
* 📦 Separate sections for Fruits, Vegetables, Dairy, Spices, and more
* 🌐 Publicly accessible and responsive front end

## 🚀 Deployment

This app is deployed to **Microsoft Azure App Service**, using:

* **PostgreSQL Flexible Server**
* **Azure Blob Storage** for media/static file hosting
* **Terraform** for infrastructure as code (IaC)
* **GitHub source deployment**

## 👷️ Tech Stack

* Python 3.12
* Django 5.1.3
* PostgreSQL
* Azure Blob Storage
* Gunicorn + Whitenoise (for WSGI and static handling)
* HTML, CSS (custom templates)

## 📌 Notes

This project was built from scratch to explore full-stack Django development with production-level deployment practices. The code and deployment are available on [GitHub](https://github.com/Aleksey-Kostov/agro_marketplace).

I hope you enjoy reviewing it!

---

## 📥 Setup & Installation

### Prerequisites

- Python 3.12+
- PostgreSQL Database
- Azure Storage Account
- Git
- Virtual Environment

### Steps to Run Locally

1. **Clone the repository**

    ```bash
    git clone https://github.com/Aleksey-Kostov/agro_marketplace.git
    cd agro_marketplace
    ```

2. **Set up a virtual environment**

    ```bash
    python -m venv .venv
    # On Windows:
    .venv\Scripts\activate
    # On Mac/Linux:
    source .venv/bin/activate
    ```

3. **Install dependencies**

    ```bash
    pip install -r requirements.txt
    ```

4. **Create your `.env` file from the example**

    ```bash
    cp .env.example .env
    ```

    - Fill in your PostgreSQL and Azure Blob Storage credentials in the `.env` file.

5. **Run migrations to set up the database**

    ```bash
    python manage.py migrate
    ```

6. **Create a superuser for accessing the Django admin**

    ```bash
    python manage.py createsuperuser
    ```

7. **Run the development server**

    ```bash
    python manage.py runserver
    ```

Your application should now be running locally at `http://127.0.0.1:8000`.

---

## ☁️ Deployment to Azure

This project is deployed using **Terraform** to manage the infrastructure on Microsoft Azure.

### Steps:

1. **Provision Azure resources** (App Service, PostgreSQL, Azure Blob Storage):

    ```bash
    terraform init
    terraform apply
    ```

2. **Deploy the app**:

    - Connect your GitHub repository to Azure App Service for automatic deployment.
    - Ensure your environment variables (Azure Storage and PostgreSQL) are set in the Azure Portal.

---

## 🔧 Troubleshooting

- If you encounter issues with Azure Blob Storage, make sure the `AZURE_CONNECTION_STRING`, `AZURE_ACCOUNT_NAME`, and container names are set correctly in the `.env` file.
- Ensure PostgreSQL credentials are correctly defined and accessible from the Django settings.

---

**Thank you for checking out Agro Marketplace!** 🌾  
Feel free to contribute or provide feedback via GitHub!
