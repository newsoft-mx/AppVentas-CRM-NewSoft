variable "aws_region" {
  description = "Region de AWS donde se desplegara Lightsail."
  type        = string
  default     = "us-east-1"
}

variable "availability_zone" {
  description = "Availability Zone para la VM y la base de datos."
  type        = string
  default     = "us-east-1a"
}

variable "project_name" {
  description = "Prefijo para los recursos."
  type        = string
  default     = "newsoft-sales"
}

variable "instance_bundle_id" {
  description = "Bundle de Lightsail para la VM."
  type        = string
  default     = "small_3_0"
}

variable "instance_blueprint_id" {
  description = "Blueprint del sistema operativo para la VM."
  type        = string
  default     = "ubuntu_24_04"
}

variable "database_bundle_id" {
  description = "Bundle de Lightsail para PostgreSQL administrado."
  type        = string
  default     = "micro_2_0"
}

variable "database_blueprint_id" {
  description = "Blueprint de PostgreSQL administrado."
  type        = string
  default     = "postgres_16"
}

variable "database_admin_username" {
  description = "Usuario administrador de PostgreSQL."
  type        = string
  default     = "newsoft_admin"
}

variable "database_admin_password" {
  description = "Password del usuario administrador de PostgreSQL."
  type        = string
  sensitive   = true
}

variable "database_name" {
  description = "Nombre de la base de datos de la aplicacion."
  type        = string
  default     = "newsoft_sales"
}

variable "session_secret" {
  description = "Secreto para firmar la sesion de la aplicacion."
  type        = string
  sensitive   = true
}

variable "admin_password" {
  description = "Password inicial para roldan@newsoft.mx cuando se ejecuta el seed."
  type        = string
  sensitive   = true
  default     = null
}

variable "sales_password" {
  description = "Password inicial para elva@newsoft.mx cuando se ejecuta el seed."
  type        = string
  sensitive   = true
  default     = null
}

variable "ssh_public_key_path" {
  description = "Ruta local a la llave publica SSH para registrar en Lightsail."
  type        = string
}

variable "ssh_private_key_path" {
  description = "Ruta local a la llave privada SSH que Terraform usara para conectarse a la VM."
  type        = string
}

variable "ssh_user" {
  description = "Usuario SSH del blueprint seleccionado."
  type        = string
  default     = "ubuntu"
}

variable "open_https_port" {
  description = "Abre el puerto 443 en la VM."
  type        = bool
  default     = true
}

variable "run_seed_on_first_deploy" {
  description = "Si es true, corre el seed una sola vez despues del primer despliegue."
  type        = bool
  default     = false
}
