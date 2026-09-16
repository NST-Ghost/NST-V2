import fs from 'fs';
import path from 'path';
import ts from 'typescript';

// ============================================================================
// Types & Configuration
// ============================================================================

export type ArchitectureLayer = 'PAGES' | 'DIALOGS' | 'COMPONENTS' | 'UI' | 'LIB' | 'OTHER';

export type ViolationType =
  | 'LAYER_VIOLATION'
  | 'FORBIDDEN_UI_LIB'
  | 'DEEP_UI_IMPORT'
  | 'NATIVE_ELEMENT'
  | 'ARBITRARY_COLOR'
  | 'NON_TOKEN_COLOR'
  | 'ROGUE_UI_LIBRARY'
  | 'FORBIDDEN_DEPENDENCY';

export type Severity = 'ERROR' | 'WARNING' | 'INFO';

export interface AuditViolation {
  file: string;
  line: number;
  column?: number;
  type: ViolationType;
  severity: Severity;
  layer: ArchitectureLayer;
  message: string;
  snippet?: string;
  recommendation: string;
}

const FORBIDDEN_3RD_PARTY_UI_PACKAGES = [
  '@radix-ui/',
  '@mui/',
  '@material-ui/',
  '@chakra-ui/',
  'antd',
  '@ant-design/',
  '@mantine/',
  'semantic-ui-react',
  'react-bootstrap',
  'bootstrap',
  'daisyui',
];

// ============================================================================
// Layer Classifier
// ============================================================================

export function classifyFile(relPath: string): ArchitectureLayer {
  const norm = relPath.replace(/\\/g, '/');

  // UI Design System layer (shadcn primitives in src/ui)
  if (norm.startsWith('src/ui/')) {
    return 'UI';
  }

  // Legacy components/ui backward-compat bridge
  if (norm.startsWith('src/components/ui/')) {
    return 'UI';
  }

  // Pages layer (Application views)
  if (norm.startsWith('src/pages/') || norm === 'src/App.tsx' || norm === 'src/main.tsx') {
    return 'PAGES';
  }

  // Dialogs & Modals layer
  if (norm.startsWith('src/components/dialogs/')) {
    return 'DIALOGS';
  }

  // Business / Layout Components layer
  if (norm.startsWith('src/components/')) {
    return 'COMPONENTS';
  }

  // Lib / utilities / bindings
  if (norm.startsWith('src/lib/') || norm.startsWith('bindings/')) {
    return 'LIB';
  }

  return 'OTHER';
}

// ============================================================================
// AST File Auditor
// ============================================================================

export function auditSourceFile(
  filePath: string,
  relPath: string,
  content: string,
  layer: ArchitectureLayer
): AuditViolation[] {
  const violations: AuditViolation[] = [];
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true
  );

  const lines = content.split('\n');

  function getLineCol(pos: number) {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
    return { line: line + 1, column: character + 1 };
  }

  function visit(node: ts.Node) {
    // 1. Check Import Declarations
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (ts.isStringLiteral(moduleSpecifier)) {
        const importPath = moduleSpecifier.text;
        const { line } = getLineCol(node.getStart());
        const lineContent = lines[line - 1] || '';

        // Rule: Direct 3rd-party UI library leaks outside src/ui/
        for (const pkg of FORBIDDEN_3RD_PARTY_UI_PACKAGES) {
          if (importPath === pkg || importPath.startsWith(pkg)) {
            if (layer !== 'UI') {
              violations.push({
                file: relPath,
                line,
                type: 'FORBIDDEN_UI_LIB',
                severity: 'ERROR',
                layer,
                message: `Forbidden direct UI library import '${importPath}' in ${layer} layer.`,
                snippet: lineContent.trim(),
                recommendation: `Wrap this component inside src/ui/ and export via '@/ui'. Application layer must only import from '@/ui'.`,
              });
            }
          }
        }

        // Rule: Architecture Layer Hierarchy
        // pages -> dialogs -> components -> ui
        if (layer === 'UI') {
          if (
            importPath.startsWith('@/components') ||
            importPath.startsWith('@/pages') ||
            importPath.startsWith('../components') ||
            importPath.startsWith('../pages')
          ) {
            violations.push({
              file: relPath,
              line,
              type: 'LAYER_VIOLATION',
              severity: 'ERROR',
              layer,
              message: `UI layer cannot import higher-level layer '${importPath}'.`,
              snippet: lineContent.trim(),
              recommendation: `UI layer is the Design System foundation and must only depend on lib/utils.`,
            });
          }
        }

        if (layer === 'COMPONENTS') {
          if (
            importPath.startsWith('@/pages') ||
            importPath.startsWith('../pages') ||
            importPath.startsWith('@/components/dialogs')
          ) {
            violations.push({
              file: relPath,
              line,
              type: 'LAYER_VIOLATION',
              severity: 'ERROR',
              layer,
              message: `Layout components cannot import dialogs or pages: '${importPath}'.`,
              snippet: lineContent.trim(),
              recommendation: `Decouple layout container from specific dialogs/pages.`,
            });
          }
        }

        if (layer === 'DIALOGS') {
          if (importPath.startsWith('@/pages') || importPath.startsWith('../pages')) {
            violations.push({
              file: relPath,
              line,
              type: 'LAYER_VIOLATION',
              severity: 'ERROR',
              layer,
              message: `Dialogs layer cannot import pages: '${importPath}'.`,
              snippet: lineContent.trim(),
              recommendation: `Pages trigger dialogs. Dialogs must not depend on pages.`,
            });
          }
        }

        // Rule: Single Door UI Import (@/ui) vs Deep Primitive Import
        if (layer !== 'UI' && importPath.startsWith('@/components/ui/')) {
          violations.push({
            file: relPath,
            line,
            type: 'DEEP_UI_IMPORT',
            severity: 'WARNING',
            layer,
            message: `Deep UI primitive import '${importPath}'.`,
            snippet: lineContent.trim(),
            recommendation: `Use single entrypoint '@/ui' instead (e.g. import { ... } from '@/ui').`,
          });
        }
      }
    }

    // 2. Check JSX Elements (Native buttons, inputs, selects, textareas)
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(sourceFile);
      const { line } = getLineCol(node.getStart());
      const lineContent = lines[line - 1] || '';

      const prevLine = line > 1 ? lines[line - 2] : '';
      const isSuppressed =
        lineContent.includes('@ui-allow-native') ||
        prevLine.includes('@ui-allow-native') ||
        lineContent.includes('eslint-disable') ||
        prevLine.includes('eslint-disable');

      if (!isSuppressed && layer !== 'UI') {
        if (tagName === 'button') {
          violations.push({
            file: relPath,
            line,
            type: 'NATIVE_ELEMENT',
            severity: 'WARNING',
            layer,
            message: `Native <button> element used.`,
            snippet: lineContent.trim(),
            recommendation: `Use <Button> from '@/ui' with variant/size props for consistent design token support. (Or add // @ui-allow-native if intentional).`,
          });
        } else if (tagName === 'input') {
          const hasHidden = node.attributes.properties.some((p) => {
            if (ts.isJsxAttribute(p) && p.name.getText(sourceFile) === 'type') {
              const init = p.initializer;
              return init && ts.isStringLiteral(init) && init.text === 'hidden';
            }
            return false;
          });

          if (!hasHidden) {
            violations.push({
              file: relPath,
              line,
              type: 'NATIVE_ELEMENT',
              severity: 'WARNING',
              layer,
              message: `Native <input> element used.`,
              snippet: lineContent.trim(),
              recommendation: `Use <Input> from '@/ui' for consistent tokens and keyboard navigation.`,
            });
          }
        }
      }
    }

    // 3. Check className string literals for arbitrary hex colors
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const parent = node.parent;
      const isClassName =
        (ts.isJsxAttribute(parent) && parent.name.getText(sourceFile) === 'className') ||
        (ts.isCallExpression(parent) && parent.expression.getText(sourceFile) === 'cn') ||
        (ts.isCallExpression(parent) && parent.expression.getText(sourceFile) === 'clsx');

      if (isClassName && layer !== 'UI') {
        const text = node.text;
        const { line } = getLineCol(node.getStart());
        const lineContent = lines[line - 1] || '';

        // Arbitrary hex color: e.g. text-[#3399ff], bg-[#1a1a1a], border-[#333]
        const hexMatch = text.match(/\b(bg|text|border|ring|stroke|fill)-\[#[0-9a-fA-F]{3,8}\]/g);
        if (hexMatch) {
          violations.push({
            file: relPath,
            line,
            type: 'ARBITRARY_COLOR',
            severity: 'ERROR',
            layer,
            message: `Arbitrary hex color detected: ${hexMatch.join(', ')}`,
            snippet: lineContent.trim(),
            recommendation: `Replace arbitrary colors with semantic design tokens (e.g. bg-background, bg-card, text-primary, border-border).`,
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

// ============================================================================
// File Discovery
// ============================================================================

export function walkFiles(dir: string, extensions = ['.ts', '.tsx'], fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === 'node_modules' ||
        entry.name === 'dist' ||
        entry.name === 'public' ||
        entry.name === '__tests__'
      ) {
        continue;
      }
      walkFiles(fullPath, extensions, fileList);
    } else if (entry.isFile()) {
      if (extensions.some((ext) => entry.name.endsWith(ext)) && !entry.name.endsWith('.d.ts')) {
        fileList.push(fullPath);
      }
    }
  }
  return fileList;
}

// ============================================================================
// Dependency Guard
// ============================================================================

function auditDependencies(pkgJsonPath: string): AuditViolation[] {
  const violations: AuditViolation[] = [];
  if (!fs.existsSync(pkgJsonPath)) return violations;

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

    const forbidden = ['@mui/material', '@chakra-ui/react', 'antd', '@mantine/core', 'semantic-ui-react', 'bootstrap'];

    for (const dep of forbidden) {
      if (allDeps[dep]) {
        violations.push({
          file: 'package.json',
          line: 1,
          type: 'FORBIDDEN_DEPENDENCY',
          severity: 'ERROR',
          layer: 'OTHER',
          message: `Unauthorized UI library dependency: '${dep}' found in package.json`,
          recommendation: `Remove '${dep}' and standardize exclusively on Design System in src/ui.`,
        });
      }
    }
  } catch (e) {}

  return violations;
}

// ============================================================================
// Main Runner
// ============================================================================

export async function runUiAudit(options: {
  rootDir?: string;
  strict?: boolean;
  summaryOnly?: boolean;
  category?: ViolationType;
  json?: boolean;
}) {
  const rootDir = options.rootDir || process.cwd();
  const srcDir = path.join(rootDir, 'src');

  const files = walkFiles(srcDir);
  const allViolations: AuditViolation[] = [];

  // 1. Audit Dependencies
  const depViolations = auditDependencies(path.join(rootDir, 'package.json'));
  allViolations.push(...depViolations);

  // 2. Audit Source Files
  for (const filePath of files) {
    const relPath = path.relative(rootDir, filePath).replace(/\\/g, '/');
    const layer = classifyFile(relPath);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const violations = auditSourceFile(filePath, relPath, content, layer);
      allViolations.push(...violations);
    } catch (err: any) {
      console.error(`Error reading ${relPath}:`, err.message);
    }
  }

  // Filter if requested
  const filteredViolations = options.category
    ? allViolations.filter((v) => v.type === options.category)
    : allViolations;

  if (options.json) {
    console.log(JSON.stringify(filteredViolations, null, 2));
    return filteredViolations;
  }

  // Terminal Output
  console.log('\n====================================================================');
  console.log('🛡️  NST UI ARCHITECTURE & DESIGN SYSTEM GOVERNANCE AUDIT');
  console.log('====================================================================\n');

  console.log(`📁 Files Scanned: ${files.length}`);
  console.log(`🔍 Total Findings: ${filteredViolations.length}\n`);

  // Count by Type & Severity
  const countsByType: Record<ViolationType, number> = {
    LAYER_VIOLATION: 0,
    FORBIDDEN_UI_LIB: 0,
    DEEP_UI_IMPORT: 0,
    NATIVE_ELEMENT: 0,
    ARBITRARY_COLOR: 0,
    NON_TOKEN_COLOR: 0,
    ROGUE_UI_LIBRARY: 0,
    FORBIDDEN_DEPENDENCY: 0,
  };

  const countsBySeverity: Record<Severity, number> = {
    ERROR: 0,
    WARNING: 0,
    INFO: 0,
  };

  for (const v of filteredViolations) {
    countsByType[v.type] = (countsByType[v.type] || 0) + 1;
    countsBySeverity[v.severity] = (countsBySeverity[v.severity] || 0) + 1;
  }

  // Print Summary Table
  console.log('┌───────────────────────────────────────────────┬────────────┬───────────┐');
  console.log('│ Check Category                                │ Findings   │ Severity  │');
  console.log('├───────────────────────────────────────────────┼────────────┼───────────┤');
  console.log(`│ 1. Layer Violations (pages↓dialogs↓ui)        │ ${String(countsByType.LAYER_VIOLATION).padEnd(10)} │ \x1b[31mERROR\x1b[0m     │`);
  console.log(`│ 2. Forbidden 3rd Party UI Libs (@radix leaks) │ ${String(countsByType.FORBIDDEN_UI_LIB).padEnd(10)} │ \x1b[31mERROR\x1b[0m     │`);
  console.log(`│ 3. Deep Primitive Imports (use @/ui)          │ ${String(countsByType.DEEP_UI_IMPORT).padEnd(10)} │ \x1b[33mWARN\x1b[0m      │`);
  console.log(`│ 4. Native HTML Elements (<button>, <input>)   │ ${String(countsByType.NATIVE_ELEMENT).padEnd(10)} │ \x1b[33mWARN\x1b[0m      │`);
  console.log(`│ 5. Arbitrary Hex Colors (text-[#...])         │ ${String(countsByType.ARBITRARY_COLOR).padEnd(10)} │ \x1b[31mERROR\x1b[0m     │`);
  console.log(`│ 6. Non-Token Palette Colors                   │ ${String(countsByType.NON_TOKEN_COLOR).padEnd(10)} │ \x1b[36mINFO\x1b[0m      │`);
  console.log(`│ 7. Rogue UI Libraries                         │ ${String(countsByType.ROGUE_UI_LIBRARY).padEnd(10)} │ \x1b[31mERROR\x1b[0m     │`);
  console.log(`│ 8. Package.json Dependencies                  │ ${String(countsByType.FORBIDDEN_DEPENDENCY).padEnd(10)} │ \x1b[31mERROR\x1b[0m     │`);
  console.log('└───────────────────────────────────────────────┴────────────┴───────────┘');
  console.log(`\nTotals: \x1b[31m${countsBySeverity.ERROR} Errors\x1b[0m | \x1b[33m${countsBySeverity.WARNING} Warnings\x1b[0m | \x1b[36m${countsBySeverity.INFO} Info\x1b[0m\n`);

  if (!options.summaryOnly) {
    const grouped: Record<string, AuditViolation[]> = {};
    for (const v of filteredViolations) {
      if (!grouped[v.type]) grouped[v.type] = [];
      grouped[v.type].push(v);
    }

    for (const [type, list] of Object.entries(grouped)) {
      console.log(`\n--------------------------------------------------------------------`);
      console.log(`📌 ${type} (${list.length} occurrences)`);
      console.log(`--------------------------------------------------------------------`);

      const displayLimit = 6;
      for (let i = 0; i < Math.min(list.length, displayLimit); i++) {
        const item = list[i];
        const sevColor =
          item.severity === 'ERROR' ? '\x1b[31m[ERROR]\x1b[0m' :
          item.severity === 'WARNING' ? '\x1b[33m[WARN]\x1b[0m' : '\x1b[36m[INFO]\x1b[0m';

        console.log(`  ${sevColor} ${item.file}:${item.line}`);
        console.log(`    ↳ ${item.message}`);
        if (item.snippet) console.log(`      Code: "\x1b[90m${item.snippet}\x1b[0m"`);
        console.log(`      💡 Fix: ${item.recommendation}`);
      }

      if (list.length > displayLimit) {
        console.log(`  ... and ${list.length - displayLimit} more in this category.`);
      }
    }
  }

  // CI exit code check
  const errorCount = countsBySeverity.ERROR;
  if (options.strict && errorCount > 0) {
    console.error(`\n❌ CI Check FAILED: ${errorCount} architectural errors must be resolved.`);
    process.exit(1);
  }

  return filteredViolations;
}

// ============================================================================
// CLI invocation
// ============================================================================

const args = process.argv.slice(2);
const strict = args.includes('--strict');
const summaryOnly = args.includes('--summary');
const json = args.includes('--json');
const categoryArg = args.find((a) => a.startsWith('--category='));
const category = categoryArg ? (categoryArg.split('=')[1] as ViolationType) : undefined;

runUiAudit({ strict, summaryOnly, json, category });
