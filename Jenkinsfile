pipeline {
    agent any

    environment {
        EXPO_TOKEN = credentials('limpa_eas_token')
    }

    stages {
        stage('Pull') {
            steps {
                sh '''
                    git config --global --add safe.directory /var/www/limpa
                    cd /var/www/limpa && git pull origin main
                '''
            }
        }

        stage('Backend') {
            steps {
                sh '''
                    cd /var/www/limpa/backend
                    npm install --omit=dev
                    npx prisma generate
                    npx tsc
                    npx prisma db push
                    pm2 restart limpa-backend
                '''
            }
        }

        stage('Admin Dashboard') {
            steps {
                sh '''
                    echo "VITE_API_BASE=http://37.60.240.199:8082" > /var/www/limpa/admin-dashboard/.env
                    cd /var/www/limpa/admin-dashboard
                    npm install --omit=dev
                    npm run build
                '''
            }
        }

        stage('Baker Dashboard') {
            steps {
                sh '''
                    echo "VITE_API_BASE=http://37.60.240.199:8082" > /var/www/limpa/dashboard/.env
                    cd /var/www/limpa/dashboard
                    npm install --omit=dev
                    npm run build
                '''
            }
        }

        stage('Mobile (EAS Cloud Build)') {
            steps {
                sh '''
                    cd /var/www/limpa/mobile
                    npm install --omit=dev
                    npx eas-cli build --platform android --profile preview --non-interactive
                '''
            }
        }

        stage('Reload Nginx') {
            steps {
                sh 'nginx -t && systemctl reload nginx'
            }
        }
    }

    post {
        success {
            echo 'Limpa deployed successfully.'
            sh 'pm2 list | grep limpa'
        }
        failure {
            echo 'Deployment failed — check console output above.'
        }
    }
}
