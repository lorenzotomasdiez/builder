#!/bin/bash
# Setup script for build-api workflow
# This script injects the build-api system into a target project

set -e

TARGET_DIR="${1:-.}"

if [ -z "$TARGET_DIR" ]; then
    echo "Usage: $0 <target-directory>"
    exit 1
fi

# Get builder directory (where this script is located)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILDER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "Setting up build-api in $TARGET_DIR..."
echo "Builder directory: $BUILDER_DIR"

# Create .pi directory structure
mkdir -p "$TARGET_DIR/.pi/agents"
mkdir -p "$TARGET_DIR/.pi/agent-sessions"

# Copy agent definitions (with correct names)
cp "$BUILDER_DIR/.pi/agents/api-initializer.md" "$TARGET_DIR/.pi/agents/" 2>/dev/null || {
    echo "Warning: api-initializer.md not found"
}
cp "$BUILDER_DIR/.pi/agents/api-planner.md" "$TARGET_DIR/.pi/agents/" 2>/dev/null || {
    echo "Warning: api-planner.md not found"
}
cp "$BUILDER_DIR/.pi/agents/api-builder.md" "$TARGET_DIR/.pi/agents/" 2>/dev/null || {
    echo "Warning: api-builder.md not found"
}
cp "$BUILDER_DIR/.pi/agents/api-tester.md" "$TARGET_DIR/.pi/agents/" 2>/dev/null || {
    echo "Warning: api-tester.md not found"
}
cp "$BUILDER_DIR/.pi/agents/build-api.yaml" "$TARGET_DIR/.pi/agents/" 2>/dev/null || {
    echo "Warning: build-api.yaml not found"
}

# Copy extension
mkdir -p "$TARGET_DIR/extensions"
cp "$BUILDER_DIR/extensions/build-api.ts" "$TARGET_DIR/extensions/" 2>/dev/null || {
    echo "Warning: extensions/build-api.ts not found"
}

# Copy templates
mkdir -p "$TARGET_DIR/templates/api"
cp -r "$BUILDER_DIR/templates/api/"* "$TARGET_DIR/templates/api/" 2>/dev/null || {
    echo "Warning: templates/api/ not found"
}

# Create product-spec directory
mkdir -p "$TARGET_DIR/product-spec"

# Create example product-spec files if they don't exist
if [ ! -f "$TARGET_DIR/product-spec/entities.yaml" ]; then
    cat > "$TARGET_DIR/product-spec/entities.yaml" << 'EOF'
entities:
  - name: User
    table: users
    fields:
      - name: email
        type: string
        unique: true
        required: true
      - name: hashed_password
        type: string
        required: true
        exclude_from_response: true
      - name: is_active
        type: boolean
        default: true
      - name: role
        type: enum
        values: [admin, user, guest]
        default: user
      - name: created_at
        type: datetime
        auto: true
    crud:
      create: admin_only
      read: authenticated
      update: owner_or_admin
      delete: admin_only
EOF
    echo "Created example entities.yaml"
fi

if [ ! -f "$TARGET_DIR/product-spec/auth.yaml" ]; then
    cat > "$TARGET_DIR/product-spec/auth.yaml" << 'EOF'
auth:
  enabled: true
  type: jwt
  jwt:
    algorithm: HS256
    access_token_expire_minutes: 30
    refresh_token_expire_days: 7
  password:
    algorithm: bcrypt
  endpoints:
    login: /auth/login
    register: /auth/register
    refresh: /auth/refresh
    me: /auth/me
  roles:
    - name: admin
      permissions: [create, read, update, delete]
    - name: user
      permissions: [create, read, update_own]
    - name: guest
      permissions: [read]
EOF
    echo "Created example auth.yaml"
fi

# Verify setup
echo ""
echo "Verifying setup..."
echo ""

FILES_OK=true

[ -f "$TARGET_DIR/.pi/agents/api-initializer.md" ] && echo "✓ api-initializer.md" || { echo "✗ api-initializer.md missing"; FILES_OK=false; }
[ -f "$TARGET_DIR/.pi/agents/api-planner.md" ] && echo "✓ api-planner.md" || { echo "✗ api-planner.md missing"; FILES_OK=false; }
[ -f "$TARGET_DIR/.pi/agents/api-builder.md" ] && echo "✓ api-builder.md" || { echo "✗ api-builder.md missing"; FILES_OK=false; }
[ -f "$TARGET_DIR/.pi/agents/api-tester.md" ] && echo "✓ api-tester.md" || { echo "✗ api-tester.md missing"; FILES_OK=false; }
[ -f "$TARGET_DIR/.pi/agents/build-api.yaml" ] && echo "✓ build-api.yaml" || { echo "✗ build-api.yaml missing"; FILES_OK=false; }
[ -f "$TARGET_DIR/extensions/build-api.ts" ] && echo "✓ extensions/build-api.ts" || { echo "✗ extensions/build-api.ts missing"; FILES_OK=false; }
[ -d "$TARGET_DIR/templates/api" ] && echo "✓ templates/api/" || { echo "✗ templates/api/ missing"; FILES_OK=false; }
[ -f "$TARGET_DIR/product-spec/entities.yaml" ] && echo "✓ product-spec/entities.yaml" || { echo "✗ product-spec/entities.yaml missing"; FILES_OK=false; }

echo ""

if [ "$FILES_OK" = true ]; then
    echo "✅ Build-API setup complete!"
    echo ""
    echo "Next steps:"
    echo "1. Edit product-spec/entities.yaml to define your entities"
    echo "2. (Optional) Edit product-spec/auth.yaml to configure authentication"
    echo "3. Run: pi -e extensions/build-api.ts"
else
    echo "❌ Setup incomplete - some files are missing"
    exit 1
fi
