pipeline {
    agent any

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
                    sudo pm2 restart limpa-backend
                '''
            }
        }

        stage('Admin Dashboard') {
            steps {
                sh '''
                    echo "VITE_API_BASE=http://37.60.240.199:8082" > /var/www/limpa/admin-dashboard/.env
                    cd /var/www/limpa/admin-dashboard
                    npm install
                    npm run build
                '''
            }
        }

        stage('Baker Dashboard') {
            steps {
                sh '''
                    echo "VITE_API_BASE=http://37.60.240.199:8082" > /var/www/limpa/dashboard/.env
                    cd /var/www/limpa/dashboard
                    npm install
                    npm run build
                '''
            }
        }

        stage('Mobile (Local Gradle Build)') {
            steps {
                sh '''
                    cd /var/www/limpa/mobile
                    npm install --legacy-peer-deps
                    chmod +x android/gradlew
                    echo "sdk.dir=/opt/android-sdk" > android/local.properties
                    cd android && ./gradlew assembleRelease --no-daemon --max-workers=2 --warning-mode none -Dkotlin.incremental=false
                '''
            }
        }

        stage('Publish APK') {
            steps {
                catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
                    sh '''
                        mkdir -p /var/www/limpa/downloads
                        cp /var/www/limpa/mobile/android/app/build/outputs/apk/release/app-release.apk /var/www/limpa/downloads/limpa.apk
                        echo "APK published → http://37.60.240.199:8082/downloads/limpa.apk"
                    '''
                }
            }
        }

        stage('Reload Nginx') {
            steps {
                sh 'sudo nginx -t && sudo systemctl reload nginx'
            }
        }
    }

    post {
        success {
            echo 'Limpa deployed successfully.'
            sh 'sudo pm2 list | grep limpa'
            archiveArtifacts artifacts: 'mobile/android/app/build/outputs/apk/release/app-release.apk', allowEmptyArchive: true
            echo 'APK ready → http://37.60.240.199:8082/downloads/limpa.apk'
        }
        failure {
            echo 'Deployment failed — check console output above.'
        }
    }
}
