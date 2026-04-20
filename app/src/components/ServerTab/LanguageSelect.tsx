import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { type LanguageCode, SUPPORTED_LANGUAGES } from '@/i18n';

export function LanguageSelect() {
  const { i18n } = useTranslation();
  const current = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language)?.code ?? 'en';

  return (
    <Select
      value={current}
      onValueChange={(value) => {
        void i18n.changeLanguage(value as LanguageCode);
      }}
    >
      <SelectTrigger className="h-9 w-[180px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_LANGUAGES.map((lang) => (
          <SelectItem key={lang.code} value={lang.code}>
            {lang.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
