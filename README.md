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

