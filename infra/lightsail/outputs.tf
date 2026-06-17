output "public_ip" {
  description = "IP publica fija de la aplicacion."
  value       = aws_lightsail_static_ip.this.ip_address
}

output "public_url" {
  description = "URL publica por IP."
  value       = "http://${aws_lightsail_static_ip.this.ip_address}"
}

output "ssh_command" {
  description = "Comando SSH para conectarse a la VM."
  value       = "ssh -i ${var.ssh_private_key_path} ${var.ssh_user}@${aws_lightsail_static_ip.this.ip_address}"
}

output "database_endpoint" {
  description = "Endpoint de PostgreSQL administrado."
  value       = "${local.database_host}:${local.database_port}"
}
