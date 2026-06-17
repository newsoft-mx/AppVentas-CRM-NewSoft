locals {
  project_root = abspath("${path.module}/../..")

  deploy_files = sort([
    for file in fileset(local.project_root, "**") : file
    if !startswith(file, ".git/")
    && !startswith(file, ".codex")
    && !startswith(file, "node_modules/")
    && !startswith(file, ".next/")
    && !startswith(file, "dist/")
    && !startswith(file, "infra/lightsail/.terraform/")
    && !startswith(file, "infra/lightsail/build/")
    && file != ".env"
    && file != ".env.local"
    && file != ".env.production"
    && file != "infra/lightsail/.terraform.lock.hcl"
    && file != "infra/lightsail/terraform.tfvars"
    && file != "infra/lightsail/tfplan"
    && !endswith(file, ".tfstate")
    && length(regexall("\\.tfstate\\.", file)) == 0
  ])

  app_checksum = sha1(join("", [
    for file in local.deploy_files : filesha1("${local.project_root}/${file}")
  ]))

  instance_name          = "${var.project_name}-app"
  database_resource_name = replace("${var.project_name}-db", "_", "-")
  static_ip_name         = "${var.project_name}-ip"
  key_pair_name          = "${var.project_name}-key"
  database_host          = aws_lightsail_database.db.master_endpoint_address
  database_port          = aws_lightsail_database.db.master_endpoint_port

  database_url = format(
    "postgresql://%s:%s@%s:%s/%s?schema=public",
    var.database_admin_username,
    urlencode(var.database_admin_password),
    local.database_host,
    local.database_port,
    var.database_name
  )
}

resource "aws_lightsail_key_pair" "this" {
  name       = local.key_pair_name
  public_key = file(pathexpand(var.ssh_public_key_path))
}

resource "aws_lightsail_database" "db" {
  relational_database_name = local.database_resource_name
  availability_zone        = var.availability_zone
  blueprint_id             = var.database_blueprint_id
  bundle_id                = var.database_bundle_id
  master_database_name     = var.database_name
  master_username          = var.database_admin_username
  master_password          = var.database_admin_password
  publicly_accessible      = true
}

resource "aws_lightsail_instance" "app" {
  name              = local.instance_name
  availability_zone = var.availability_zone
  blueprint_id      = var.instance_blueprint_id
  bundle_id         = var.instance_bundle_id
  key_pair_name     = aws_lightsail_key_pair.this.name

  user_data = templatefile("${path.module}/templates/user-data.sh.tftpl", {
    app_dir        = "/opt/${var.project_name}"
    database_url   = local.database_url
    port           = 3000
    project_name   = var.project_name
    session_secret = var.session_secret
    admin_password = coalesce(var.admin_password, "")
    sales_password = coalesce(var.sales_password, "")
    ssh_user       = var.ssh_user
  })
}

resource "aws_lightsail_static_ip" "this" {
  name = local.static_ip_name
}

resource "aws_lightsail_static_ip_attachment" "this" {
  static_ip_name = aws_lightsail_static_ip.this.name
  instance_name  = aws_lightsail_instance.app.name
}

resource "aws_lightsail_instance_public_ports" "this" {
  instance_name = aws_lightsail_instance.app.name

  port_info {
    protocol          = "tcp"
    from_port         = 22
    to_port           = 22
    cidrs             = ["0.0.0.0/0"]
    ipv6_cidrs        = ["::/0"]
    cidr_list_aliases = []
  }

  port_info {
    protocol          = "tcp"
    from_port         = 80
    to_port           = 80
    cidrs             = ["0.0.0.0/0"]
    ipv6_cidrs        = ["::/0"]
    cidr_list_aliases = []
  }

  dynamic "port_info" {
    for_each = var.open_https_port ? [443] : []
    content {
      protocol          = "tcp"
      from_port         = port_info.value
      to_port           = port_info.value
      cidrs             = ["0.0.0.0/0"]
      ipv6_cidrs        = ["::/0"]
      cidr_list_aliases = []
    }
  }
}

resource "null_resource" "package_app" {
  triggers = {
    app_checksum = local.app_checksum
  }

  provisioner "local-exec" {
    command = "bash ${local.project_root}/scripts/package-deploy.sh ${path.module}/build newsoft-sales-deploy.tgz"
  }
}

resource "null_resource" "deploy_app" {
  depends_on = [
    aws_lightsail_static_ip_attachment.this,
    aws_lightsail_instance_public_ports.this,
    aws_lightsail_database.db,
    null_resource.package_app,
  ]

  triggers = {
    app_checksum   = local.app_checksum
    host           = aws_lightsail_static_ip.this.ip_address
    database_url   = local.database_url
    session_secret = sha1(var.session_secret)
  }

  connection {
    type        = "ssh"
    host        = aws_lightsail_static_ip.this.ip_address
    user        = var.ssh_user
    private_key = file(pathexpand(var.ssh_private_key_path))
    timeout     = "10m"
  }

  provisioner "file" {
    source      = "${path.module}/build/newsoft-sales-deploy.tgz"
    destination = "/tmp/newsoft-sales-deploy.tgz"
  }

  provisioner "file" {
    content     = <<-EOF
      POSTGRES_PRISMA_URL="${local.database_url}"
      POSTGRES_URL_NON_POOLING="${local.database_url}"
      SESSION_SECRET="${var.session_secret}"
      ADMIN_PASSWORD="${coalesce(var.admin_password, "")}"
      SALES_PASSWORD="${coalesce(var.sales_password, "")}"
      PORT=3000
    EOF
    destination = "/tmp/newsoft-sales.env.production"
  }

  provisioner "remote-exec" {
    inline = [
      "cloud-init status --wait || true",
      "sudo apt-get update",
      "if ! command -v docker >/dev/null 2>&1; then sudo apt-get install -y docker.io; fi",
      "if ! docker compose version >/dev/null 2>&1; then sudo apt-get install -y docker-compose-plugin || true; fi",
      "if [ ! -x /usr/local/bin/docker-compose-v2 ]; then sudo curl -fsSL https://github.com/docker/compose/releases/download/v2.27.0/docker-compose-linux-x86_64 -o /usr/local/bin/docker-compose-v2 && sudo chmod +x /usr/local/bin/docker-compose-v2; fi",
      "sudo systemctl enable docker || true",
      "sudo systemctl start docker || true",
      "if [ ! -f /swapfile ]; then sudo fallocate -l 4G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=4096; sudo chmod 600 /swapfile; sudo mkswap /swapfile; echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab; fi",
      "sudo swapon /swapfile || true",
      "if docker compose version >/dev/null 2>&1; then COMPOSE_CMD='sudo docker compose'; elif [ -x /usr/local/bin/docker-compose-v2 ]; then COMPOSE_CMD='sudo /usr/local/bin/docker-compose-v2'; else echo 'Docker Compose v2 is not available' >&2; exit 1; fi",
      "sudo mkdir -p /opt/${var.project_name}",
      "sudo tar -xzf /tmp/newsoft-sales-deploy.tgz -C /opt/${var.project_name} --strip-components=1",
      "sudo mv /tmp/newsoft-sales.env.production /opt/${var.project_name}/.env.production",
      "sudo chown ${var.ssh_user}:${var.ssh_user} /opt/${var.project_name}/.env.production",
      "sudo chown -R ${var.ssh_user}:${var.ssh_user} /opt/${var.project_name}",
      "cd /opt/${var.project_name} && bash -lc \"$COMPOSE_CMD --env-file .env.production -f docker-compose.prod.yml -f docker-compose.prod.direct.yml down --remove-orphans || true\"",
      "cd /opt/${var.project_name} && bash -lc \"$COMPOSE_CMD --env-file .env.production -f docker-compose.prod.yml -f docker-compose.prod.direct.yml build app tools\"",
      "cd /opt/${var.project_name} && bash -lc \"$COMPOSE_CMD --env-file .env.production -f docker-compose.prod.yml -f docker-compose.prod.direct.yml run --rm tools npx prisma migrate deploy\"",
      var.run_seed_on_first_deploy ? "if [ ! -f /opt/${var.project_name}/.seeded ]; then cd /opt/${var.project_name} && bash -lc \"$COMPOSE_CMD --env-file .env.production -f docker-compose.prod.yml -f docker-compose.prod.direct.yml run --rm tools npm run db:seed\" && sudo touch /opt/${var.project_name}/.seeded; fi" : "true",
      "cd /opt/${var.project_name} && bash -lc \"$COMPOSE_CMD --env-file .env.production -f docker-compose.prod.yml -f docker-compose.prod.direct.yml up -d app\"",
    ]
  }
}
