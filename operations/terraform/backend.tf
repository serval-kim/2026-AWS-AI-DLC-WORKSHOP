terraform {
  backend "s3" {
    bucket         = "hanmuncheol-terraform-state"
    key            = "operations/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-locks"
    encrypt        = true
  }
}
