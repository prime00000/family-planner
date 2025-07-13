# Multi-Agent Planning System Environment Variables

## Quick Start

To enable the new multi-agent planning system, set the following in your `.env.local`:

```bash
USE_NEW_PLANNING_SYSTEM=true
```

## Environment Variables Reference

### Core Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `USE_NEW_PLANNING_SYSTEM` | Enable multi-agent planning system | `false` | No |
| `ANTHROPIC_API_KEY` | Your Anthropic API key | - | Yes |

### Agent Model Configuration

#### Organizing Agent (Claude Opus 4)
Handles dialogue, planning approach, and task assignment.

| Variable | Description | Default |
|----------|-------------|---------|
| `ORGANIZING_AGENT_MODEL` | Model identifier | `claude-opus-4-20250514` |
| `ORGANIZING_AGENT_MAX_TOKENS` | Maximum response tokens | `4000` |
| `ORGANIZING_AGENT_TEMPERATURE` | Response creativity (0-1) | `0.2` |

#### Selection Agent (Claude Opus 4)
Optimizes task selection based on priorities and capacity.

| Variable | Description | Default |
|----------|-------------|---------|
| `SELECTION_AGENT_MODEL` | Model identifier | `claude-opus-4-20250514` |
| `SELECTION_AGENT_MAX_TOKENS` | Maximum response tokens | `4000` |
| `SELECTION_AGENT_TEMPERATURE` | Response creativity (0-1) | `0.3` |

#### Editing Agent (Claude Sonnet 3.7)
Creates/modifies tasks and generates final plan JSON.

| Variable | Description | Default |
|----------|-------------|---------|
| `EDITING_AGENT_MODEL` | Model identifier | `claude-3-7-sonnet-20250219` |
| `EDITING_AGENT_MAX_TOKENS` | Maximum response tokens | `3000` |
| `EDITING_AGENT_TEMPERATURE` | Response creativity (0-1) | `0.1` |

### Timeout and Retry Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `AGENT_DEFAULT_TIMEOUT` | Agent operation timeout (ms) | `25000` |
| `AGENT_MAX_RETRIES` | Maximum retry attempts | `3` |

### Legacy System

| Variable | Description | Default |
|----------|-------------|---------|
| `ANTHROPIC_MODEL` | Legacy single-agent model | `claude-3-7-sonnet-20250219` |

### Subscription Limits

| Variable | Description | Default |
|----------|-------------|---------|
| `AI_MINUTES_FREE_LIFETIME` | Free tier lifetime minutes | `30` |
| `AI_MINUTES_BASIC_MONTHLY` | Basic tier monthly minutes | `300` |
| `AI_MINUTES_PRO_MONTHLY` | Pro tier monthly minutes | `1000` |

## Example Configuration

### Development (.env.local)
```bash
# Enable new system for testing
USE_NEW_PLANNING_SYSTEM=true

# Use faster models for development
ORGANIZING_AGENT_MODEL=claude-3-5-sonnet-20241022
SELECTION_AGENT_MODEL=claude-3-5-sonnet-20241022

# Shorter timeouts for faster feedback
AGENT_DEFAULT_TIMEOUT=15000
```

### Production (.env.production)
```bash
# Keep new system disabled until fully tested
USE_NEW_PLANNING_SYSTEM=false

# Use recommended models
ORGANIZING_AGENT_MODEL=claude-opus-4-20250514
SELECTION_AGENT_MODEL=claude-opus-4-20250514
EDITING_AGENT_MODEL=claude-3-7-sonnet-20250219

# Standard timeouts
AGENT_DEFAULT_TIMEOUT=25000
AGENT_MAX_RETRIES=3
```

## Migration Guide

1. **Testing Phase**: Set `USE_NEW_PLANNING_SYSTEM=true` in development only
2. **Gradual Rollout**: Use feature flags to enable for specific users
3. **Full Migration**: Set to `true` in production after thorough testing
4. **Rollback**: Simply set to `false` to revert to legacy system

## Troubleshooting

### Models Not Available
If you see errors about model availability:
1. Check your Anthropic API key has access to Opus models
2. Try fallback models: `claude-3-5-sonnet-20241022`
3. Contact Anthropic support for model access

### Timeout Issues
If agents are timing out:
1. Increase `AGENT_DEFAULT_TIMEOUT` (max 290000 for Vercel)
2. Check network connectivity
3. Monitor agent progress in UI

### High Token Usage
To reduce costs:
1. Lower `*_MAX_TOKENS` values
2. Adjust `*_TEMPERATURE` closer to 0
3. Monitor usage via subscription limits