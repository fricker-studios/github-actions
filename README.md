# GitHub Actions - Reusable Workflows

This repository contains reusable GitHub Actions workflows for building Docker images across different architectures.

## Available Workflows

### 1. Build ARM Image (`build-arm-image.yml`)
Builds a Docker image specifically for ARM64 architecture (linux/arm64).

### 2. Build AMD Image (`build-amd-image.yml`)
Builds a Docker image specifically for AMD64 architecture (linux/amd64).

### 3. Build Multiarch Image (`build-multiarch-image.yml`)
Builds a Docker image for multiple architectures in a single manifest (default: linux/amd64 and linux/arm64).

## Quick Start

To use these reusable workflows in your repository, reference them in your workflow files:

```yaml
name: Build My Docker Image

on:
  push:
    branches: [main]

jobs:
  build-multiarch:
    uses: fricker-studios/github-actions/.github/workflows/build-multiarch-image.yml@main
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

All three workflows share the following common inputs:

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `image_name` | Name of the Docker image to build (e.g., `myorg/myapp`) | Yes | - |
| `dockerfile_path` | Path to the Dockerfile | No | `./Dockerfile` |
| `context` | Build context path | No | `.` |
| `build_args` | Build arguments (comma-separated KEY=VALUE pairs) | No | `''` |
| `push` | Whether to push the image to registry | No | `false` |
| `tags` | Additional tags for the image (newline-separated) | No | `''` |

**Additional input for multiarch workflow:**

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `platforms` | Target platforms (comma-separated) | No | `linux/amd64,linux/arm64` |

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
    uses: fricker-studios/github-actions/.github/workflows/build-arm-image.yml@main
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
    uses: fricker-studios/github-actions/.github/workflows/build-amd-image.yml@main
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
    uses: fricker-studios/github-actions/.github/workflows/build-multiarch-image.yml@main
    with:
      image_name: myorg/myapp
      platforms: linux/amd64,linux/arm64,linux/arm/v7
      build_args: VERSION=${{ github.event.inputs.version }},BUILD_DATE=${{ github.run_number }}
      push: true
      tags: |
        latest
        ${{ github.event.inputs.version }}
    secrets:
      registry_username: ${{ secrets.DOCKER_USERNAME }}
      registry_password: ${{ secrets.DOCKER_PASSWORD }}
```

### Example 4: Build All Architectures in Parallel

```yaml
name: Build All Architectures

on:
  push:
    branches: [main]

jobs:
  build-arm:
    uses: fricker-studios/github-actions/.github/workflows/build-arm-image.yml@main
    with:
      image_name: myorg/myapp
      push: true
      tags: latest
    secrets:
      registry_username: ${{ secrets.DOCKER_USERNAME }}
      registry_password: ${{ secrets.DOCKER_PASSWORD }}

  build-amd:
    uses: fricker-studios/github-actions/.github/workflows/build-amd-image.yml@main
    with:
      image_name: myorg/myapp
      push: true
      tags: latest
    secrets:
      registry_username: ${{ secrets.DOCKER_USERNAME }}
      registry_password: ${{ secrets.DOCKER_PASSWORD }}
```

### Example 5: Using Workflow Outputs

```yaml
name: Build and Deploy

on:
  push:
    branches: [main]

jobs:
  build:
    uses: fricker-studios/github-actions/.github/workflows/build-multiarch-image.yml@main
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

### Example 6: Building from a Subdirectory

```yaml
name: Build from Subdirectory

on:
  push:
    branches: [main]

jobs:
  build:
    uses: fricker-studios/github-actions/.github/workflows/build-multiarch-image.yml@main
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
    uses: fricker-studios/github-actions/.github/workflows/build-multiarch-image.yml@main
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
- ✅ **Caching**: Automatic GitHub Actions cache for faster builds
- ✅ **Flexible tagging**: Support for multiple tags per build
- ✅ **Build arguments**: Pass custom build arguments to Docker
- ✅ **Registry agnostic**: Works with any Docker registry
- ✅ **Output support**: Access image tags and digests in dependent jobs
- ✅ **QEMU support**: Cross-platform builds using QEMU emulation
- ✅ **Buildx integration**: Uses Docker Buildx for advanced features

## Prerequisites

To use these workflows, your repository needs:

1. A valid `Dockerfile` in your repository
2. Docker registry credentials configured as GitHub secrets (if pushing images)
3. Appropriate permissions for the GitHub token (if using GHCR)

## Troubleshooting

### Build fails with "unauthorized" error
- Verify your registry credentials are correct
- Check that the secrets are properly configured in your repository settings
- Ensure the `push` input is set to `true` if you want to push images

### Build is slow or times out
- Consider using build caching more effectively
- Split multiarch builds into separate jobs if needed
- Optimize your Dockerfile for layer caching

### Platform not supported
- Check that your base image supports the target platform
- Verify QEMU is properly set up (handled automatically by the workflow)

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
