# WorkforceBD

WorkforceBD is a Bangladesh-first, mobile-first workforce marketplace that connects businesses with temporary workers in real time. It is not a job board, ERP, or HR management system. The platform uses a single application with role-based experiences for workers, businesses, and admins. Workers can discover nearby shifts, apply instantly, build reputation, and earn money flexibly. Businesses can create shifts, hire reliable workers, and manage operations efficiently. The platform focuses heavily on trust through verification, ratings, attendance tracking, and reliability scores. Location and proximity are core features for fast staffing. The experience should feel social, modern, and lightweight rather than corporate. Everything is optimized for speed, trust, and daily engagement. The ultimate goal is to become the real-time workforce infrastructure for Bangladesh.

## Project Structure

This is a Web Application built with Next.js TypeScript.
 

## Development Guidelines

### Coding Style

- Use server components by default.
- Use nextjs best practices
- Component based
- Theme colors should be centralized so that can be changed easily later if require.

### Tech Stack/ Packages
- use redux toolkit for state management
- use react hook for for forms
- use zod for validation
- use packages which has better community support.


### Testing Approach

- Test edge cases and error conditions

## Files to Avoid

- node_modules/
- .env files
- Build artifacts (dist/, build/)
- Log files

## Special Instructions

- See /docs/FRONTEND_CONTEXT.md for frontend context
- **See /docs/api-guidelines.md for backend integration.** (ALWAYS FOLLOW THE API GUIDELINE TO MATCH THE UI WITH THE API's AND KEEP THE UI/UX CONSISTENT).
- backend is served on `https://workforcebd.onrender.com/api/v1`
- See /docs/DESIGN.md file for design preferances

## Working with Claude Code

### Preferred Workflow

1. **Explore**: First understand the codebase
2. **Plan**: Discuss the approach before coding
3. **Code**: Implement with best practices
4. **Commit**: Use conventional commits

### Git Workflow

- Use Claude for 90% of git operations
- Create descriptive commit messages
- Branch naming: feature/*, bugfix/*, docs/*

### Communication Style

- Ask clarifying questions before implementing
- Explain technical decisions
- Suggest improvements when relevant
- Point out potential issues proactively

