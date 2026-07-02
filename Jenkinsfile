pipeline {
    agent any

    tools {
        nodejs 'NodeJS-22'
    }

    environment {
        IMAGE_NAME = 'tasklist-backend'
        IMAGE_TAG  = "${BUILD_NUMBER}"
    }

    stages {

        stage('Install') {
            steps {
                sh 'npm ci'
                sh 'npx prisma generate'
            }
        }

        stage('Build') {
            steps {
                sh 'npm run build'
            }
        }

        stage('Unit Tests') {
            steps {
                sh 'npm run test:coverage'
            }
            post {
                always {
                    junit 'reports/junit.xml'
                    publishHTML(target: [
                        allowMissing         : false,
                        alwaysLinkToLastBuild: true,
                        keepAll              : true,
                        reportDir            : 'coverage',
                        reportFiles          : 'index.html',
                        reportName           : 'Coverage Report'
                    ])
                }
            }
        }

        stage('E2E Tests') {
            steps {
                sh 'npm run test:e2e'
            }
            post {
                always {
                    junit testResults: 'reports/junit-e2e.xml', allowEmptyResults: true
                }
            }
        }

        stage('Security Scan') {
            steps {
                sh 'npm audit --audit-level=high'
                sh 'gitleaks detect --source . --no-banner --redact'
            }
        }

        stage('SonarQube Analysis') {
            steps {
                withSonarQubeEnv('SonarQube') {
                    sh 'npx sonar-scanner'
                }
            }
        }

        stage('Quality Gate') {
            steps {
                timeout(time: 5, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        stage('Docker Build') {
            steps {
                sh "docker build -t ${IMAGE_NAME}:${IMAGE_TAG} -t ${IMAGE_NAME}:latest ."
            }
        }

        stage('Image Scan') {
            steps {
                sh "trivy image --exit-code 1 --severity HIGH,CRITICAL --no-progress ${IMAGE_NAME}:${IMAGE_TAG}"
            }
        }

        stage('Push & Deploy') {
            when { branch 'main' }
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'registry-creds',
                    usernameVariable: 'REG_USER',
                    passwordVariable: 'REG_PASS'
                )]) {
                    sh '''
                        echo "$REG_PASS" | docker login registry.example.com -u "$REG_USER" --password-stdin
                        docker tag ${IMAGE_NAME}:${IMAGE_TAG} registry.example.com/${IMAGE_NAME}:${IMAGE_TAG}
                        docker push registry.example.com/${IMAGE_NAME}:${IMAGE_TAG}
                    '''
                }
            }
        }
    }

    post {
        always {
            cleanWs()
        }
        success {
            echo "Pipeline success — image: ${IMAGE_NAME}:${IMAGE_TAG}"
        }
        failure {
            echo "Pipeline failed — check logs"
        }
    }
}