# GitHub Actions - Reusable Workflows

This repository contains reusable GitHub Actions workflows for building Docker images across different architectures on the fricker-studios CI fleet (ARC scale sets in the `ci` k3s cluster; see homelab's `docs/rack-spec/runbooks/ci-fleet-offload-plan.md`).

## Available Workflows

### 1. Build ARM Image (`build-arm-image.yml`)
Builds a Docker image for linux/arm64, natively, on the `arc-runner-fricker-arm64` scale set (Raspberry Pi 4 boards). Tags are suffixed `-arm64`.

### 2. Build AMD Image (`build-amd-image.yml`)
Builds a Docker image for linux/amd64, natively, on the `arc-runner-fricker-amd64` scale set. Tags are suffixed `-amd64`.

### 3. Build Multiarch Image (`build-multiarch-image.yml`)
Builds both architectures in parallel (one job per scale set) and then creates one multi-arch index per tag with `docker buildx imagetools create`. The job fails unless the index lists both `linux/arm64` and `linux/amd64`.

### Self-test (`selftest-build-image.yml`)
This repo's own CI: builds `selftest/Dockerfile` through the multiarch workflow, pushes it to the lab registry as `github-actions-selftest`, then pulls the index on **each** pool and runs it (the container prints the machine it was built on). Run it against a branch before merging a change to the build workflows:

```bash
gh workflow run selftest-build-image.yml --ref <branch>
```

## Prerequisites

⚠️ **Runners are named, not labelled.** ARC scale sets match `runs-on` on the scale-set name only; a label list such as `[self-hosted, ARM64]` never matches one, which is why these workflows could not run between 2026-02 and 2026-10. The names are inputs with the fleet's defaults:

| Input | Default | Used by |
|-------|---------|---------|
| `arm_runner` | `arc-runner-fricker-arm64` | the arm64 build (and arm64 smoke) |
| `amd_runner` | `arc-runner-fricker-amd64` | the amd64 build and the manifest step |

Both pools run docker-in-docker, so `docker build`/`buildx` work without further setup. Any other runner that has Docker and buildx works too (for example `ubuntu-24.04-arm` for the arm64 build when the fleet is down).

**Registry.** `registry` defaults to the lab's zot, `registry.lab.alexfricker.com`. An `image_name` without a registry host (`devpi`, `alexfricker/website`) is pushed under that registry; one that already names a host (`docker.io/alexfricker/etl-api`, `ghcr.io/...`) is used as given — docker's own rule for the first path component. The org secrets `REGISTRY_USERNAME` / `REGISTRY_PASSWORD` are the lab registry's `pusher` account. To push to Docker Hub, pass `registry: ''` (no login) or `registry: docker.io` with Docker Hub credentials.

**Build cache.** `type=registry` on the image's own repository, one tag per architecture (`<image>:buildcache-arm64`, `<image>:buildcache-amd64`) so the parallel jobs never overwrite each other's export, with the `image-manifest=true,oci-mediatypes=true` flags zot needs. The cache is exported only when `push: true`. Not `type=gha`: through the LAN actions-cache every blob would round-trip MinIO twice.

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

### Common Inputs (All Workflows)

All three workflows share the following common inputs:

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `image_name` | Name of the Docker image to build (e.g., `myorg/myapp`) | Yes | - |
| `dockerfile_path` | Path to the Dockerfile | No | `./Dockerfile` |
| `context` | Build context path | No | `.` |
| `build_args` | Build arguments (newline-separated KEY=VALUE pairs) | No | `''` |
| `push` | Whether to push the image (and its build cache) to the registry | No | `false` |
| `registry` | Registry to log in to and to prefix a host-less `image_name` with; empty means Docker Hub and no login | No | `registry.lab.alexfricker.com` |
| `tags` | Additional tags for the image (newline-separated); the commit sha is always tagged | No | `''` |
| `arm_runner` | Scale set for the arm64 build (`build-arm-image.yml`, `build-multiarch-image.yml`) | No | `arc-runner-fricker-arm64` |
| `amd_runner` | Scale set for the amd64 build and the manifest step (`build-amd-image.yml`, `build-multiarch-image.yml`) | No | `arc-runner-fricker-amd64` |
| `download_artifacts` / `artifact_name` / `artifact_path` | Download a build artifact into the workspace before building | No | `false` / `''` / `.` |
| `sentry_dsn_var_name` | Build-arg name to inject the `sentry_dsn` secret as | No | `''` |

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
| `image_name` | Image name without tag, registry included |
| `image_tag` | Short tag: the first custom tag (multiarch) or `<sha>-<arch>` (single-arch) |
| `image_fullname` | `image_name:image_tag` |
| `digest` | The multi-arch index digest (multiarch, when pushed) or the image digest (single-arch) |

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
    uses: fricker-studios/github-actions/.github/workflows/build-multiarch-image.yml@main
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

### Example 6: Using Workflow Outputs

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

### Example 7: Building from a Subdirectory

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
- ✅ **Native architecture builds**: one ARC scale set per architecture (no QEMU emulation overhead)
- ✅ **Parallel builds**: ARM and AMD builds run simultaneously for faster execution
- ✅ **Caching**: `type=registry` build cache per architecture on the lab registry
- ✅ **Flexible tagging**: Support for multiple tags per build
- ✅ **Build arguments**: Pass custom build arguments to Docker
- ✅ **Registry agnostic**: Works with any Docker registry
- ✅ **Output support**: Access image tags and digests in dependent jobs
- ✅ **Manifest creation**: Multiarch workflow automatically creates and pushes Docker manifests

## Prerequisites

To use these workflows, you need:

1. **ARC scale sets** named `arc-runner-fricker-arm64` and `arc-runner-fricker-amd64` (or your own, via the `arm_runner` / `amd_runner` inputs), each with docker-in-docker
2. A valid `Dockerfile` in your repository
3. Docker registry credentials configured as GitHub secrets (if pushing images)
4. Appropriate permissions for the GitHub token (if using GHCR)

## Troubleshooting

### The job sits at "Waiting for a runner to pick up this job"
- The scale set named by `arm_runner` / `amd_runner` is not registered: `gh api orgs/fricker-studios/actions/runners -q '.runners[].name'` lists what is online
- In the ci cluster: `kubectl --context ci -n arc-systems get pods` (one listener per scale set) and `kubectl --context ci -n arc-runners get pods -o wide`

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
