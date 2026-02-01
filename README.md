# GitHub Actions - Reusable Workflows

This repository contains reusable GitHub Actions workflows for building Docker images across different architectures using self-hosted runners.

## Available Workflows

### 1. Build ARM Image (`build-arm-image/workflow.yml`)
Builds a Docker image specifically for ARM64 architecture (linux/arm64) on self-hosted ARM64 runners.

### 2. Build AMD Image (`build-amd-image/workflow.yml`)
Builds a Docker image specifically for AMD64 architecture (linux/amd64) on self-hosted X64 runners.

### 3. Build Multiarch Image (`build-multiarch-image/workflow.yml`)
Builds ARM64 and AMD64 images in parallel using the ARM and AMD workflows, then creates a multiarch manifest combining both architectures.

## Prerequisites

⚠️ **Important**: These workflows require self-hosted runners with the following labels:
- **ARM64**: Self-hosted runners tagged with `ARM64` label for ARM64 builds
- **X64**: Self-hosted runners tagged with `X64` label for AMD64 builds

Make sure your self-hosted runners have Docker installed and properly configured before using these workflows.

## Quick Start

To use these reusable workflows in your repository, reference them in your workflow files:

```yaml
name: Build My Docker Image

on:
  push:
    branches: [main]

jobs:
  build-multiarch:
    uses: fricker-studios/github-actions/.github/workflows/build-multiarch-image/workflow.yml@main
    with:
      image_name: myorganization/myapp
      push: true
      tags: |
        latest
        v1.0.0
    secrets:
      registry_username: ${{ secrets.DOCKER_USERNAME }}
      registry_password: ${{ secrets.DOCKER_PASSWORD }}
```

## Workflow Inputs

### Common Inputs (All Workflows)

All three workflows share the following common inputs:

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `image_name` | Name of the Docker image to build (e.g., `myorg/myapp`) | Yes | - |
| `dockerfile_path` | Path to the Dockerfile | No | `./Dockerfile` |
| `context` | Build context path | No | `.` |
| `build_args` | Build arguments (comma-separated KEY=VALUE pairs) | No | `''` |
| `push` | Whether to push the image to registry | No | `false` |
| `tags` | Additional tags for the image (newline-separated) | No | `''` |

### Architecture-Specific Inputs (Multiarch Workflow Only)

The multiarch workflow supports optional architecture-specific parameters that override the common parameters for each architecture:

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `arm_dockerfile_path` | Path to the Dockerfile for ARM build (overrides `dockerfile_path`) | No | `''` |
| `arm_context` | Build context path for ARM build (overrides `context`) | No | `''` |
| `arm_build_args` | Build arguments for ARM build (overrides `build_args`) | No | `''` |
| `amd_dockerfile_path` | Path to the Dockerfile for AMD build (overrides `dockerfile_path`) | No | `''` |
| `amd_context` | Build context path for AMD build (overrides `context`) | No | `''` |
| `amd_build_args` | Build arguments for AMD build (overrides `build_args`) | No | `''` |

**Note**: If architecture-specific parameters are not provided (empty string), the workflow will use the common parameters (`dockerfile_path`, `context`, `build_args`) for both architectures.

## Workflow Secrets

| Secret | Description | Required |
|--------|-------------|----------|
| `registry_username` | Docker registry username | No* |
| `registry_password` | Docker registry password | No* |

*Required only if `push: true` is set.

## Workflow Outputs

All workflows provide the following outputs:

| Output | Description |
|--------|-------------|
| `image_tag` | Full image tag that was built |
| `digest` | Image digest |

## Usage Examples

### Example 1: Build ARM Image Only

```yaml
name: Build ARM Image

on:
  push:
    branches: [main]

jobs:
  build-arm:
    uses: fricker-studios/github-actions/.github/workflows/build-arm-image/workflow.yml@main
    with:
      image_name: myorg/myapp
      dockerfile_path: ./docker/Dockerfile
      context: .
      push: false
```

### Example 2: Build AMD Image with Custom Tags

```yaml
name: Build AMD Image

on:
  release:
    types: [published]

jobs:
  build-amd:
    uses: fricker-studios/github-actions/.github/workflows/build-amd-image/workflow.yml@main
    with:
      image_name: myorg/myapp
      push: true
      tags: |
        latest
        ${{ github.ref_name }}
    secrets:
      registry_username: ${{ secrets.DOCKER_USERNAME }}
      registry_password: ${{ secrets.DOCKER_PASSWORD }}
```

### Example 3: Build Multiarch Image with Build Arguments

```yaml
name: Build Multiarch Image

on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Version tag'
        required: true

jobs:
  build-multiarch:
    uses: fricker-studios/github-actions/.github/workflows/build-multiarch-image/workflow.yml@main
    with:
      image_name: myorg/myapp
      build_args: VERSION=${{ github.event.inputs.version }},BUILD_DATE=${{ github.run_number }}
      push: true
      tags: |
        latest
        ${{ github.event.inputs.version }}
    secrets:
      registry_username: ${{ secrets.DOCKER_USERNAME }}
      registry_password: ${{ secrets.DOCKER_PASSWORD }}
```

Note: The multiarch workflow automatically builds for both AMD64 and ARM64 architectures using separate self-hosted runners in parallel.

### Example 4: Build Multiarch Image with Architecture-Specific Dockerfiles

If you need different Dockerfiles or build contexts for ARM and AMD:

```yaml
name: Build Multiarch Image with Different Dockerfiles

on:
  push:
    branches: [main]

jobs:
  build-multiarch:
    uses: fricker-studios/github-actions/.github/workflows/build-multiarch-image/workflow.yml@main
    with:
      image_name: myorg/myapp
      # Common parameters (used if architecture-specific ones aren't provided)
      dockerfile_path: ./Dockerfile
      context: .
      # ARM-specific overrides
      arm_dockerfile_path: ./Dockerfile.arm64
      arm_context: ./arm
      arm_build_args: ARCH=arm64,OPTIMIZATION=neon
      # AMD-specific overrides
      amd_dockerfile_path: ./Dockerfile.amd64
      amd_context: ./amd
      amd_build_args: ARCH=amd64,OPTIMIZATION=avx2
      push: true
      tags: |
        latest
        v1.0.0
    secrets:
      registry_username: ${{ secrets.DOCKER_USERNAME }}
      registry_password: ${{ secrets.DOCKER_PASSWORD }}
```

This allows you to optimize each architecture build separately, for example:
- Using architecture-specific optimizations in build arguments
- Different Dockerfiles that install architecture-specific dependencies
- Separate build contexts with architecture-specific files

### Example 5: Build All Architectures in Parallel (Manual Control)

If you need to manually control individual architecture builds:

```yaml
name: Build All Architectures

on:
  push:
    branches: [main]

jobs:
  build-arm:
    uses: fricker-studios/github-actions/.github/workflows/build-arm-image/workflow.yml@main
    with:
      image_name: myorg/myapp
      push: true
      tags: latest
    secrets:
      registry_username: ${{ secrets.DOCKER_USERNAME }}
      registry_password: ${{ secrets.DOCKER_PASSWORD }}

  build-amd:
    uses: fricker-studios/github-actions/.github/workflows/build-amd-image/workflow.yml@main
    with:
      image_name: myorg/myapp
      push: true
      tags: latest
    secrets:
      registry_username: ${{ secrets.DOCKER_USERNAME }}
      registry_password: ${{ secrets.DOCKER_PASSWORD }}
```

### Example 6: Using Workflow Outputs

```yaml
name: Build and Deploy

on:
  push:
    branches: [main]

jobs:
  build:
    uses: fricker-studios/github-actions/.github/workflows/build-multiarch-image/workflow.yml@main
    with:
      image_name: myorg/myapp
      push: true
      tags: latest
    secrets:
      registry_username: ${{ secrets.DOCKER_USERNAME }}
      registry_password: ${{ secrets.DOCKER_PASSWORD }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy with built image
        run: |
          echo "Deploying image: ${{ needs.build.outputs.image_tag }}"
          echo "Image digest: ${{ needs.build.outputs.digest }}"
          # Add your deployment commands here
```

### Example 7: Building from a Subdirectory

```yaml
name: Build from Subdirectory

on:
  push:
    branches: [main]

jobs:
  build:
    uses: fricker-studios/github-actions/.github/workflows/build-multiarch-image/workflow.yml@main
    with:
      image_name: myorg/myapp
      dockerfile_path: ./services/api/Dockerfile
      context: ./services/api
      push: true
    secrets:
      registry_username: ${{ secrets.DOCKER_USERNAME }}
      registry_password: ${{ secrets.DOCKER_PASSWORD }}
```

## Docker Registry Support

These workflows support any Docker registry that uses standard authentication:

- **Docker Hub**: Use your Docker Hub username and personal access token
- **GitHub Container Registry (ghcr.io)**: Use `${{ github.actor }}` and `${{ secrets.GITHUB_TOKEN }}`
- **AWS ECR**: Use AWS credentials configured for ECR
- **Google Container Registry (GCR)**: Use service account credentials
- **Azure Container Registry (ACR)**: Use service principal credentials

### Example: Using GitHub Container Registry

```yaml
jobs:
  build:
    uses: fricker-studios/github-actions/.github/workflows/build-multiarch-image/workflow.yml@main
    with:
      image_name: ghcr.io/${{ github.repository }}
      push: true
      tags: |
        latest
        ${{ github.sha }}
    secrets:
      registry_username: ${{ github.actor }}
      registry_password: ${{ secrets.GITHUB_TOKEN }}
```

## Features

- ✅ **Multi-architecture support**: Build for ARM64, AMD64, or both
- ✅ **Native architecture builds**: Uses self-hosted runners (no QEMU emulation overhead)
- ✅ **Parallel builds**: ARM and AMD builds run simultaneously for faster execution
- ✅ **Caching**: Automatic GitHub Actions cache for faster builds
- ✅ **Flexible tagging**: Support for multiple tags per build
- ✅ **Build arguments**: Pass custom build arguments to Docker
- ✅ **Registry agnostic**: Works with any Docker registry
- ✅ **Output support**: Access image tags and digests in dependent jobs
- ✅ **Manifest creation**: Multiarch workflow automatically creates and pushes Docker manifests

## Prerequisites

To use these workflows, you need:

1. **Self-hosted runners** with the following labels:
   - `ARM64` label for ARM64 builds
   - `X64` label for AMD64 builds
   - Docker installed and properly configured on all runners
2. A valid `Dockerfile` in your repository
3. Docker registry credentials configured as GitHub secrets (if pushing images)
4. Appropriate permissions for the GitHub token (if using GHCR)

## Troubleshooting

### Build fails with "No runner matching the specified labels"
- Ensure you have self-hosted runners configured with `ARM64` and `X64` labels
- Verify the runners are online and available
- Check that Docker is installed on the runners

### Build fails with "unauthorized" error
- Verify your registry credentials are correct
- Check that the secrets are properly configured in your repository settings
- Ensure the `push` input is set to `true` if you want to push images

### Build is slow or times out
- Consider using build caching more effectively
- Ensure your self-hosted runners have adequate resources
- Optimize your Dockerfile for layer caching

### Manifest creation fails
- Ensure both ARM and AMD builds completed successfully
- Verify the images were pushed to the registry (push must be true)
- Check that the registry supports Docker manifests

## Contributing

To contribute to these reusable workflows:

1. Fork this repository
2. Create a feature branch
3. Make your changes
4. Test the workflows in your fork
5. Submit a pull request

## License

This project is open source and available under the MIT License.

## Support

For issues, questions, or contributions, please open an issue in this repository.
