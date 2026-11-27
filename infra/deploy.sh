#!/usr/bin/env bash
# Trien khai (hoac cap nhat) stack CloudFormation "musicwave-ops".
# Dung: ALERT_EMAIL=ban@example.com bash infra/deploy.sh
# Yeu cau: AWS CLI da dang nhap, Node.js (de cai thu vien cho Lambda).
set -euo pipefail
cd "$(dirname "$0")"

REGION="${AWS_REGION:-ap-southeast-1}"
STACK="${STACK_NAME:-musicwave-ops}"
ENV_NAME="${EB_ENV:-Musicwave-env}"
ALERT_EMAIL="${ALERT_EMAIL:?Hay dat bien ALERT_EMAIL}"
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
ARTIFACT_BUCKET="${ARTIFACT_BUCKET:-elasticbeanstalk-$REGION-$ACCOUNT}"
ASG=$(aws elasticbeanstalk describe-environment-resources --region "$REGION" --environment-name "$ENV_NAME" \
  --query 'EnvironmentResources.AutoScalingGroups[0].Name' --output text)

echo "==> Cai thu vien cho Lambda xu ly nhac"
(cd lambda/process-audio && npm install --omit=dev --no-audit --no-fund)

echo "==> Dong goi ma Lambda len s3://$ARTIFACT_BUCKET/cloudformation/"
aws cloudformation package --region "$REGION" \
  --template-file cloudformation/musicwave-ops.yaml \
  --s3-bucket "$ARTIFACT_BUCKET" --s3-prefix cloudformation \
  --output-template-file cloudformation/packaged.yaml

echo "==> Trien khai stack $STACK"
aws cloudformation deploy --region "$REGION" \
  --stack-name "$STACK" \
  --template-file cloudformation/packaged.yaml \
  --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
  --parameter-overrides AlertEmail="$ALERT_EMAIL" AutoScalingGroupName="$ASG" \
  --no-fail-on-empty-changeset

aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" \
  --query 'Stacks[0].[StackStatus, Outputs[].[OutputKey,OutputValue]]' --output text
