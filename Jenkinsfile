pipeline {
    agent {
        label 'dtl'
    }
    environment {
        MINIO_BUCKET = 'liman-centralmon'
        MINIO_ENDPOINT = 'https://miniodtlfaz2.bulut.ai'
    }
    stages {
        stage('Install Node.js') {
            steps {
                sh '''
                    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
                    sudo apt-get install -y nodejs jq zip
                '''
            }
        }
        stage('Install pnpm') {
            steps {
                sh '''
                    corepack enable pnpm
                '''
            }
        }
        stage('Install Dependencies & Build Extension') {
            steps {
                sh '''
                    #!/bin/bash
                    cd frontend
                    pnpm install
                    pnpm build
                    
                    cd ..
                    rm -rf frontend
                    rm -rf .git
                    rm -rf .github
                    
                    version=$(jq ".version = \\"${BUILD_NUMBER}\\"" db.json)
                    echo "$version" > db.json

                    version_code=$(jq ".version_code = ${BUILD_NUMBER}" db.json)
                    echo "$version_code" > db.json

                    rm -f .gitignore
                    zip -r /tmp/liman-centralmon-${BRANCH_NAME}-${BUILD_NUMBER}.zip .
                '''
            }
        }
        stage('MinIO Upload') {
            steps {
                withCredentials([string(credentialsId: 'minio-credentials', variable: 'MINIO_CREDENTIALS')]) {
                    sh '''
                        #!/bin/bash
                        ACCESS_KEY=$(echo "$MINIO_CREDENTIALS" | cut -d':' -f1)
                        SECRET_KEY=$(echo "$MINIO_CREDENTIALS" | cut -d':' -f2)

                        /usr/local/bin/mc config host add minio "$MINIO_ENDPOINT" "$ACCESS_KEY" "$SECRET_KEY"
                        /usr/local/bin/mc cp /tmp/liman-centralmon-${BRANCH_NAME}-${BUILD_NUMBER}.zip minio/"$MINIO_BUCKET"/
                    '''
                }
            }
        }
    }
}
