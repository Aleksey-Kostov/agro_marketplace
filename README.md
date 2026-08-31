# 🌾 Agro Marketplace — Demo Django Project

**Live Demo:** https://agro-marketplace-yo35.onrender.com/

## 📋 Project Overview

This is my first Django project — a demo application deployed to **Render**. The goal of the project is to create an **online marketplace** for agricultural products, where **buyers and sellers can connect** directly.

### 🔑 Key Features

* ✅ User authentication with a custom user model
* 🛒 Sellers can post ads for agricultural products
* 🛍️ Buyers can browse and respond to product ads
* 💬 Built-in messaging system for communication between users
* 👤 User profiles with the ability to:

  * Edit profile details
  * Manage ads (activate/deactivate, delete)
* 📦 Separate sections for Fruits, Vegetables, Dairy, Spices, and more
* 🌐 Publicly accessible and responsive front end

## 🚀 Deployment

This application is deployed to **Render** using:

* **Render Web Service** — Production application hosting
* **PostgreSQL** — Production database
* **Cloudinary** — Media and image storage
* **Terraform** — Infrastructure as Code (IaC)
* **GitHub Actions** — Automated testing, checks, and deployment
* **Gunicorn** — Production WSGI server
* **Whitenoise** — Static file handling

## 👷 Tech Stack

* **Python 3.12** — Backend programming language
* **Django 5.1.3** — Web framework
* **PostgreSQL** — Production relational database
* **Cloudinary** — Cloud storage and media management for uploaded images and files
* **Gunicorn** — Production WSGI application server
* **Whitenoise** — Static file serving and handling
* **HTML5 & CSS3** — Custom frontend templates and styling
* **GitHub Actions** — Automated CI checks and deployment workflow
* **Terraform** — Infrastructure as Code
* **Render** — Production hosting and deployment

## 📌 Notes

This project was built from scratch to explore full-stack Django development and production deployment practices.

The source code and deployment configuration are available on [GitHub](https://github.com/Aleksey-Kostov/agro_marketplace).

I hope you enjoy reviewing it!

---

## 📥 Setup & Installation

### Prerequisites

Before running the project, make sure you have the following installed or configured:

* **Python 3.12+**
* **PostgreSQL** database
* **Cloudinary** account for media storage
* **Git**
* **Python virtual environment** (`venv`)
* **Render** account for production deployment
* **GitHub** account for repository hosting and GitHub Actions

<details>
<summary>Steps to Run Locally</summary>

1. **Clone the repository**

   ```bash
   git clone https://github.com/Aleksey-Kostov/agro_marketplace.git
   cd agro_marketplace
   ```

2. **Set up a virtual environment**

   ```bash
   python -m venv .venv
   ```

   **Windows:**

   ```bash
   .venv\Scripts\activate
   ```

   **Mac/Linux:**

   ```bash
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

   Configure your PostgreSQL and Cloudinary credentials in the `.env` file.

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

Your application should now be running locally at:

`http://127.0.0.1:8000`

</details>

<details>
<summary>Deployment to Render</summary>

This project is deployed to **Render** using **Terraform** to manage the production web service configuration and **GitHub Actions** to automate the deployment workflow.

The application runs on **Python 3.12** with **Django 5.1.3**, **PostgreSQL**, **Cloudinary**, **Gunicorn**, and **Whitenoise**.

### Steps

1. **Initialize and apply Terraform**

   ```bash
   terraform init
   terraform plan
   terraform apply
   ```

2. **Configure Render environment variables**

   Set the required production environment variables in the **Render Dashboard**, including:

   * Django settings
   * PostgreSQL connection settings
   * `CLOUDINARY_URL`
   * Superuser credentials

3. **Deploy through GitHub Actions**

   Push changes to the `main` branch:

   ```bash
   git add .
   git commit -m "Update application"
   git push origin main
   ```

   GitHub Actions then:

   * Runs Django system checks
   * Installs project dependencies
   * Collects static files
   * Triggers the Render deployment
   * Waits for the Render deployment to complete
   * Reports the final deployment status

4. **Production server**

   Render runs the application using **Gunicorn** with the configured Django WSGI application.

</details>

---

## 🔧 Troubleshooting

* If you encounter issues with **Cloudinary**, make sure `CLOUDINARY_URL` is correctly configured in the `.env` file locally and in the Render environment variables for production.

* If PostgreSQL connection errors occur, verify that the following variables are correctly configured:

  ```text
  DB_NAME
  DB_USER
  DB_PASSWORD
  DB_HOST
  DB_PORT
  ```

* Make sure the Django `SECRET_KEY` and `ALLOWED_HOSTS` settings are correctly configured for the current environment.

* If static files are not loading, verify the **Whitenoise** configuration and run:

  ```bash
  python manage.py collectstatic --noinput
  ```

* If the application fails to start on **Render**, check the Render deployment logs and verify that the Gunicorn start command is configured correctly.

* For deployment issues, check the **GitHub Actions** workflow logs to confirm that Django checks pass and the Render deployment is triggered successfully.

---

**Thank you for checking out Agro Marketplace!** 🌾

Feel free to contribute or provide feedback via [GitHub](https://github.com/Aleksey-Kostov/agro_marketplace).
