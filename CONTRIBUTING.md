# Contributing to MediCore

Thank you for your interest in contributing to MediCore Clinic Management System. This document provides guidelines and best practices for development.

## 🚨 Critical Rules

### ❌ NEVER
- Remove or break existing features
- Lose workflows, logic, permissions, or relations
- Introduce unused, duplicated, or dead code
- Impair offline-first behavior
- Break Arabic/English compatibility
- Change behavior silently without documentation
- Use `any` type without justification
- Commit sensitive data (encryption keys, real patient data)

### ✅ ALWAYS
- Ensure backward compatibility
- Keep app 100% functional at all times
- Write clean, readable, documented code
- Test both RTL and LTR modes
- Test both Electron and web modes
- Update translations for UI changes
- Log audit trails for sensitive operations
- Handle errors gracefully (no uncaught exceptions)

## 📋 Development Guidelines

### Code Style

**TypeScript:**
- Use strict mode
- Prefer interfaces over types for objects
- Use explicit return types for functions
- No implicit `any`
- Use optional chaining (`?.`) and nullish coalescing (`??`)

**React:**
- Functional components only
- Use hooks (useState, useEffect, useMemo, useCallback)
- Lazy load pages with React.lazy + Suspense
- Keep components focused (single responsibility)
- Extract reusable logic into custom hooks

**CSS:**
- Use Tailwind utility classes
- Prefer design system helpers (`buildButtonClasses`, etc.)
- Support both light and dark modes
- Test with seasonal decorations active
- Always add `dir={dir}` to modals/overlays for RTL

**Naming:**
- Components: PascalCase (`Dashboard.tsx`)
- Functions/variables: camelCase (`loadPatients`)
- Constants: UPPER_SNAKE_CASE (`ADMIN_HASH`)
- Database columns: snake_case (`created_at`)
- Files: Match primary export (`dbService.ts` exports `dbService`)

### File Organization

```
Add new features in this order:
1. Type definitions → types/
2. Service logic → services/
3. UI components → components/
4. Page implementation → pages/
5. Translations → utils/translations.ts
6. Tests (if applicable)
```

### Database Changes

**Schema Migrations:**
1. Increment `CURRENT_SCHEMA_VERSION` in `services/db.ts`
2. Add migration logic in `migrate()` method
3. Use `addCol()` helper for new columns
4. Test with existing data
5. Document breaking changes

**Queries:**
- Always use parameterized queries (never string interpolation)
- Return empty arrays on error (don't throw in UI)
- Use `dbService.query()` for SELECT
- Use `dbService.exec()` for INSERT/UPDATE/DELETE
- Log audit trails for sensitive changes

### Internationalization (i18n)

**Adding Translations:**
1. Add key to `utils/translations.ts` under both `en` and `ar`
2. Use `t('key')` in components via `useLanguage()` hook
3. Keep translations short and clear
4. Test RTL layout with Arabic
5. Use semantic keys (not English text as keys)

**RTL Support:**
- Use `dir={dir}` on modals, tooltips, dropdowns
- Use `rtl:` Tailwind variants for directional styles
- Test icon positions (swap left/right in RTL)
- Check number/date formatting

### Security

**Authentication:**
- Never expose passwords in logs or errors
- Use `hashPassword()` from `utils/security.ts`
- Validate user permissions on every sensitive operation
- Check `user?.role` before showing admin features

**Data Protection:**
- Encrypt database in Electron mode (AES-256)
- Validate all user inputs
- Sanitize data before SQL queries (use params)
- Don't store sensitive data in localStorage (use dbService)

**Audit Logging:**
```typescript
// Log all sensitive operations
dbService.logAudit(
  userId,
  'ACTION_NAME',
  'Details about what changed'
);
```

### Error Handling

**Good:**
```typescript
try {
  const data = dbService.query("SELECT * FROM patients");
  setPatients(data);
} catch (error) {
  console.error('Failed to load patients:', error);
  setPatients([]); // Graceful degradation
  showErrorNotification('Failed to load patients');
}
```

**Bad:**
```typescript
// ❌ No error handling
const data = dbService.query("SELECT * FROM patients");
setPatients(data);
```

### Testing Checklist

Before submitting changes:

- [ ] Tested in light mode
- [ ] Tested in dark mode
- [ ] Tested in English (LTR)
- [ ] Tested in Arabic (RTL)
- [ ] Tested with seasonal decoration active
- [ ] Tested in web mode (browser)
- [ ] Tested in Electron mode (if relevant)
- [ ] Tested with portable mode (if storage-related)
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] All features still work
- [ ] Translations added
- [ ] Audit logs added (if sensitive)

### Performance

**Optimization:**
- Use `useMemo()` for expensive computations
- Use `useCallback()` for function props
- Lazy load large components
- Debounce search inputs
- Paginate large lists
- Use React Window for virtualization (1000+ items)

**Database:**
- Index frequently queried columns
- Avoid N+1 queries (batch when possible)
- Use transactions for multiple writes
- Clean up old audit logs periodically

### UI/UX Guidelines

**Buttons:**
```typescript
import { buildButtonClasses } from '../services/designSystem';

<button className={buildButtonClasses('primary')}>
  Save
</button>
```

**Inputs:**
```typescript
import { buildInputClasses } from '../services/designSystem';

<input 
  className={buildInputClasses(hasError ? 'error' : 'default')}
  {...props}
/>
```

**Loading States:**
```typescript
{isLoading && (
  <Loader2 className="w-5 h-5 animate-spin" />
)}
```

**Empty States:**
```typescript
{items.length === 0 && (
  <div className="text-center py-12 text-gray-500">
    <InboxIcon size={48} className="mx-auto mb-4 opacity-50" />
    <p>No items found</p>
  </div>
)}
```

### Git Workflow

**Branches:**
- `main` - Production-ready code
- `develop` - Integration branch
- `feature/*` - New features
- `bugfix/*` - Bug fixes
- `hotfix/*` - Emergency fixes

**Commits:**
```
type(scope): description

✨ feat(patients): add vitals trend charts
🐛 fix(printing): correct RTL layout in prescriptions
📝 docs(readme): update installation instructions
♻️ refactor(sync): migrate to lanSyncService
🎨 style(dashboard): improve card layouts
🔒 security(auth): add rate limiting
```

**Pull Requests:**
1. Create feature branch from `develop`
2. Implement changes
3. Test thoroughly (see checklist)
4. Update documentation
5. Create PR with description of changes
6. Request code review
7. Address feedback
8. Merge after approval

### Code Review Checklist

Reviewers should check:

- [ ] Code follows style guidelines
- [ ] No breaking changes to existing features
- [ ] Translations added for UI changes
- [ ] RTL mode works correctly
- [ ] Error handling is robust
- [ ] Security best practices followed
- [ ] Performance is acceptable
- [ ] Tests pass (if applicable)
- [ ] Documentation updated

### Common Patterns

**Loading Data:**
```typescript
useEffect(() => {
  const loadData = () => {
    try {
      const data = dbService.query("SELECT * FROM table");
      setData(data);
    } catch (error) {
      console.error('Failed to load:', error);
      setData([]);
    }
  };
  
  loadData();
}, [/* dependencies */]);
```

**Form Handling:**
```typescript
const [form, setForm] = useState({ name: '', email: '' });

const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  
  try {
    dbService.exec(
      "INSERT INTO table (name, email) VALUES (?, ?)",
      [form.name, form.email]
    );
    
    dbService.logAudit(user.id, 'CREATE', `Created ${form.name}`);
    
    onSuccess();
  } catch (error) {
    console.error('Save failed:', error);
    showError('Failed to save');
  }
};
```

**Modal Pattern:**
```typescript
{showModal && createPortal(
  <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" dir={dir}>
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full">
      {/* Modal content */}
    </div>
  </div>,
  document.body
)}
```

### Documentation

**Code Comments:**
- Explain WHY, not WHAT
- Document complex algorithms
- Add JSDoc for public APIs
- Mark deprecated code with `@deprecated`

**README Updates:**
- Document new features
- Update configuration examples
- Add troubleshooting entries
- Keep screenshots up-to-date

### Support

For questions or clarification:
- Check existing code for patterns
- Review this document
- Ask in team chat
- Create discussion issue

## 🙏 Thank You

Your contributions help make MediCore better for healthcare professionals worldwide. We appreciate your dedication to quality and patient care.

---

**Remember:** Medical software requires the highest standards. When in doubt, prioritize stability and data integrity over features.
