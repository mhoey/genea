FROM golang:1.27-bookworm

# Avoid prompts during installation
ENV DEBIAN_FRONTEND=noninteractive

# Install essential system dependencies and build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ca-certificates \
    curl \
    git \
    gnupg2 \
    htop \
    less \
    nano \
    procps \
    sudo \
    tar \
    unzip \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root developer user with sudo privileges
ARG USERNAME=zed
ARG USER_UID=1000
ARG USER_GID=$USER_UID

RUN groupadd --gid $USER_GID $USERNAME \
    && useradd --uid $USER_UID --gid $USER_GID -m -s /bin/bash $USERNAME \
    && echo "$USERNAME ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/$USERNAME \
    && chmod 0440 /etc/sudoers.d/$USERNAME

# Configure Go environment paths and toolchain behavior
ENV GOPATH=/go
ENV GOTOOLCHAIN=auto
ENV PATH=$GOPATH/bin:/home/$USERNAME/go/bin:$PATH

# Ensure GOPATH permissions allow package installations by non-root user
RUN mkdir -p /go/bin /go/pkg /go/src \
    && chown -R $USERNAME:$USERNAME /go

# Switch to non-root user to install Go developer tooling
USER $USERNAME

# Install standard Go development tools:
# - gopls: Go language server required by Zed for LSP features
# - dlv (Delve): Debug adapter protocol engine used by Zed debugger
# - golangci-lint: Fast multi-linter
# - gotests: Automatic test generator
# - gomodifytags: Struct tag manipulator
RUN go install golang.org/x/tools/gopls@latest \
    && go install github.com/go-delve/delve/cmd/dlv@latest \
    && go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest \
    && go install github.com/cweill/gotests/...@latest \
    && go install github.com/fatih/gomodifytags@latest

# Set default user and working directory
WORKDIR /workspace
CMD ["sleep", "infinity"]
