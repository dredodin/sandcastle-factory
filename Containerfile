# Base image of a sandbox: git, gh, jq, Claude Code, Copilot CLI, Codex CLI, and an `agent` user aligned with the host.
# Built as sandcastle-factory:base by the setup wizard; a repo's own Containerfile (home repo: .sandcastle/repos/<repo>/Containerfile) starts FROM it and adds what its verify.sh needs.
FROM node:22-bookworm

RUN apt-get update && apt-get install -y \
  git \
  curl \
  jq \
  && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
  | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
  | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
  && apt-get update && apt-get install -y gh \
  && rm -rf /var/lib/apt/lists/*

# Host-aligned owner: `sandcastle podman build-image` defaults these to the host
# user's UID/GID, so bind-mounted worktrees and image-built files share an owner.
ARG AGENT_UID=1000
ARG AGENT_GID=1000
RUN groupmod -o -g $AGENT_GID node && usermod -o -u $AGENT_UID -g $AGENT_GID -d /home/agent -m -l agent node

RUN npm install -g @github/copilot @openai/codex

USER ${AGENT_UID}:${AGENT_GID}

RUN curl -fsSL https://claude.ai/install.sh | bash
ENV PATH="/home/agent/.local/bin:$PATH"

# Sandcastle bind-mounts each worktree at /home/agent/workspace and starts there.
WORKDIR /home/agent
ENTRYPOINT ["sleep", "infinity"]
