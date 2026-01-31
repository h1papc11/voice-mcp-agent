import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import {
  Frame,
  CardGroup,
  MintlifyCard,
  Steps,
  Step,
  Tip,
  Note,
  Warning,
  Info,
  Danger,
  AccordionGroup,
  Accordion,
} from '@/components/mintlify-compat';
import { APIPage } from '@/components/api-page';

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    // Mintlify compatibility components
    Frame,
    CardGroup,
    Card: MintlifyCard,
    Steps,
    Step,
    Tip,
    Note,
    Warning,
    Info,
    Danger,
    AccordionGroup,
    Accordion,
    // OpenAPI component
    APIPage,
    ...components,
  };
}
