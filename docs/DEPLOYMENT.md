# Deployment Guide

## Local Development

### Prerequisites
- Node.js 16+
- PostgreSQL 12+
- npm or yarn

### Setup

```bash
# Clone repository
git clone https://github.com/cwin/lifecycle-admin.git
cd lifecycle-admin

# Install dependencies
npm install
cd frontend && npm install && cd ..

# Create environment file
cp .env.example .env

# Update .env with local database credentials

# Create database
createdb cwin_lifecycle

# Start backend
npm start

# In another terminal, start frontend
cd frontend
npm start
```

### Local URLs
- Backend: http://localhost:5000/api
- Frontend: http://localhost:3000

## Docker Deployment

### Build Docker Image

```bash
docker build -t cwin-lifecycle-admin:latest .
```

### Run Container

```bash
docker run -p 5000:5000 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/db \
  -e JWT_SECRET=your-secret \
  cwin-lifecycle-admin:latest
```

### Docker Compose

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:14
    environment:
      POSTGRES_USER: cwin
      POSTGRES_PASSWORD: password
      POSTGRES_DB: cwin_lifecycle
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  backend:
    build: .
    ports:
      - "5000:5000"
    environment:
      DATABASE_URL: postgresql://cwin:password@postgres:5432/cwin_lifecycle
      JWT_SECRET: dev-secret-key
    depends_on:
      - postgres

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      REACT_APP_API_URL: http://localhost:5000/api

volumes:
  postgres_data:
```

## AWS Deployment

### Prerequisites
- AWS Account
- AWS CLI configured
- ECR repository created

### Steps

1. **Build and Push Docker Image**
   ```bash
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin [ACCOUNT].dkr.ecr.us-east-1.amazonaws.com
   
   docker build -t cwin-lifecycle-admin .
   docker tag cwin-lifecycle-admin:latest [ACCOUNT].dkr.ecr.us-east-1.amazonaws.com/cwin-lifecycle-admin:latest
   docker push [ACCOUNT].dkr.ecr.us-east-1.amazonaws.com/cwin-lifecycle-admin:latest
   ```

2. **Create RDS Database**
   ```bash
   aws rds create-db-instance \
     --db-instance-identifier cwin-lifecycle-prod \
     --db-instance-class db.t3.micro \
     --engine postgres \
     --master-username admin \
     --master-user-password [PASSWORD] \
     --allocated-storage 20
   ```

3. **Create ECS Cluster**
   ```bash
   aws ecs create-cluster --cluster-name cwin-lifecycle-prod
   ```

4. **Register Task Definition**
   ```bash
   aws ecs register-task-definition --cli-input-json file://task-definition.json
   ```

5. **Create Service**
   ```bash
   aws ecs create-service \
     --cluster cwin-lifecycle-prod \
     --service-name cwin-api \
     --task-definition cwin-lifecycle:1 \
     --desired-count 2 \
     --launch-type FARGATE
   ```

### Environment Variables for AWS

```bash
DATABASE_URL=postgresql://admin:[PASSWORD]@cwin-lifecycle-prod.c9akciq32.us-east-1.rds.amazonaws.com:5432/cwin_lifecycle
JWT_SECRET=[GENERATE-SECURE-KEY]
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=[KEY]
AWS_SECRET_ACCESS_KEY=[SECRET]
SENDGRID_API_KEY=[KEY]
TWILIO_ACCOUNT_SID=[SID]
```

## Heroku Deployment

### Prerequisites
- Heroku CLI installed
- Git repository initialized

### Deploy

```bash
# Login to Heroku
heroku login

# Create app
heroku create cwin-lifecycle-admin

# Add PostgreSQL
heroku addons:create heroku-postgresql:hobby-dev

# Set environment variables
heroku config:set JWT_SECRET=your-secret
heroku config:set NODE_ENV=production

# Deploy
git push heroku main

# View logs
heroku logs --tail
```

## Production Checklist

- [ ] Environment variables configured
- [ ] Database backups enabled
- [ ] SSL/TLS certificates installed
- [ ] Monitoring and logging configured
- [ ] Auto-scaling policies set
- [ ] Security groups configured
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] Database migrations run
- [ ] Smoke tests passing
- [ ] Load testing completed
- [ ] Security audit completed
- [ ] Disaster recovery tested

## Monitoring

### Datadog Integration

```bash
heroku config:set DATADOG_API_KEY=your-key
heroku config:set DATADOG_SITE=datadoghq.com
```

### CloudWatch Integration (AWS)

```bash
aws logs create-log-group --log-group-name /ecs/cwin-lifecycle
```

## Scaling

### Auto-scaling Configuration

```bash
# AWS Auto Scaling
aws autoscaling create-auto-scaling-group \
  --auto-scaling-group-name cwin-asg \
  --min-size 2 \
  --max-size 10 \
  --desired-capacity 2
```

### Database Scaling

- Monitor connection count
- Consider read replicas if needed
- Use connection pooling (PgBouncer)

## Rollback Procedure

### Git Rollback
```bash
git revert [COMMIT_HASH]
git push heroku main
```

### Docker Rollback
```bash
# Get previous image
docker images | grep cwin-lifecycle-admin

# Push previous version
docker tag cwin-lifecycle-admin:previous-hash latest
docker push [ACCOUNT].dkr.ecr.us-east-1.amazonaws.com/cwin-lifecycle-admin:latest

# Update ECS service to use new image
aws ecs update-service --cluster cwin-lifecycle-prod --service cwin-api --force-new-deployment
```

## Database Migrations

```bash
# Create migration
npx knex migrate:make create_clients_table

# Run migrations
npx knex migrate:latest

# Rollback
npx knex migrate:rollback
```

---

For more information, see [README.md](../README.md) and [ARCHITECTURE.md](ARCHITECTURE.md)
