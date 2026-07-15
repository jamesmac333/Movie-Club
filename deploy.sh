#!/bin/bash

# --- Color Codes for Aesthetic Formatting ---
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}        Movie Club App - Google Cloud Project Migration         ${NC}"
echo -e "${BLUE}================================================================${NC}"
echo ""

# Ensure gcloud CLI is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: 'gcloud' CLI is not installed.${NC}"
    echo "Please download and install the Google Cloud SDK first:"
    echo "https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Ensure user is authenticated
echo -e "${BLUE}[1/5] Verifying GCP Authentication...${NC}"
gcloud auth list --filter=status=ACTIVE --format="value(account)" > /dev/null
if [ $? -ne 0 ] || [ -z "$(gcloud auth list --filter=status=ACTIVE --format="value(account)")" ]; then
    echo -e "${YELLOW}No active GCP account found. Opening authentication page...${NC}"
    gcloud auth login
else
    echo -e "${GREEN}✓ Authenticated as: $(gcloud auth list --filter=status=ACTIVE --format='value(account)')${NC}"
fi

# Prompt for Project ID
echo ""
echo -e "${BLUE}[2/5] Setting Target GCP Project...${NC}"
# Show current project if any
CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null)
if [ ! -z "$CURRENT_PROJECT" ]; then
    read -p "Enter your GCP Project ID [Default: $CURRENT_PROJECT]: " PROJECT_ID
    PROJECT_ID=${PROJECT_ID:-$CURRENT_PROJECT}
else
    read -p "Enter your GCP Project ID: " PROJECT_ID
fi

if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}Error: Project ID is required to migrate application.${NC}"
    exit 1
fi

# Set active project
echo "Configuring gcloud target project to: $PROJECT_ID..."
gcloud config set project "$PROJECT_ID"
if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Failed to set project to '$PROJECT_ID'. Make sure the Project ID exists and you have access.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Target project successfully configured.${NC}"

# Define service configurations
REGION="us-central1"
REPO_NAME="movie-club"
SERVICE_NAME="movie-club-app"

# Enable required Google APIs
echo ""
echo -e "${BLUE}[3/5] Enabling required Google Cloud APIs...${NC}"
echo "Enabling Artifact Registry, Cloud Build, and Cloud Run APIs. This can take a minute..."
gcloud services enable \
    artifactregistry.googleapis.com \
    cloudbuild.googleapis.com \
    run.googleapis.com
if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Failed to enable required APIs. Please verify your billing/permissions.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ APIs enabled successfully.${NC}"

# Set up Artifact Registry repository
echo ""
echo -e "${BLUE}[4/5] Checking/Creating Artifact Registry Repository...${NC}"
# Check if repo exists
gcloud artifacts repositories describe "$REPO_NAME" --location="$REGION" &> /dev/null
if [ $? -ne 0 ]; then
    echo "Repository '$REPO_NAME' not found in $REGION. Creating..."
    gcloud artifacts repositories create "$REPO_NAME" \
        --repository-format=docker \
        --location="$REGION" \
        --description="Docker repository for Movie Club App"
    if [ $? -ne 0 ]; then
        echo -e "${RED}Error: Failed to create Artifact Registry repository.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Repository '$REPO_NAME' created in $REGION.${NC}"
else
    echo -e "${GREEN}✓ Repository '$REPO_NAME' already exists in $REGION.${NC}"
fi

# Submit Build to Cloud Build
echo ""
echo -e "${BLUE}[5/5] Submitting application to Cloud Build and deploying...${NC}"
echo "We are packaging, compiling, and deploying your entire Movie Club App to your Cloud Run service..."
gcloud builds submit --config=cloudbuild.yaml \
    --substitutions=_REGION="$REGION",_REPOSITORY_NAME="$REPO_NAME",_SERVICE_NAME="$SERVICE_NAME"
if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Cloud Build or deployment failed.${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}================================================================${NC}"
echo -e "${GREEN}🎉 CONGRATULATIONS! Your Movie Club App was migrated successfully!${NC}"
echo -e "${GREEN}================================================================${NC}"
echo ""
# Fetch service URL
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region="$REGION" --format="value(status.url)")
echo -e "Your Cloud Run App URL: ${BLUE}$SERVICE_URL${NC}"
echo ""
echo -e "${YELLOW}👉 IMPORTANT: Cloud Run Storage / Persistence Guide${NC}"
echo "Cloud Run containers are stateless, so dynamic data written to 'server-db.json'"
echo "(e.g., reviews, ratings, profile picture overrides) will reset when instances scale down."
echo ""
echo "To achieve absolute persistence easily without any code changes:"
echo "1. Create a Google Cloud Storage bucket in your project:"
echo "   gcloud storage buckets create gs://$PROJECT_ID-db --location=$REGION"
echo ""
echo "2. Save a copy of your current 'server-db.json' inside the bucket."
echo ""
echo "3. Mount the bucket to Cloud Run via volume mounts:"
echo "   - Open your Google Cloud Console."
echo "   - Go to Cloud Run -> click '$SERVICE_NAME' -> click 'Edit & Deploy New Revision'."
echo "   - Under 'Volumes' tab, click 'Add Volume' -> select 'Cloud Storage bucket'."
echo "   - Enter bucket name '$PROJECT_ID-db' and name the volume 'db-volume'."
echo "   - Scroll to container settings -> 'Volume Mounts' -> Mount 'db-volume' to Path '/app/server-db-volume'."
echo "   - (Or you can use Firestore or a relational database for a production database)."
echo ""
echo -e "${YELLOW}👉 Next Steps: Map Custom Domain${NC}"
echo "To connect your custom domain to your new Cloud Run deployment:"
echo "1. Go to Google Cloud Console -> Cloud Run."
echo "2. Click 'Manage Custom Domains' at the top of the services list."
echo "3. Click 'Add Mapping', select '$SERVICE_NAME', and enter your custom domain (e.g., mymovieclub.com)."
echo "4. Follow the instructions to add the displayed TXT/CNAME records to your Domain Registrar's DNS settings."
echo ""
