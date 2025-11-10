import { IconCloud } from "@tabler/icons-react"
import { useTranslation } from 'react-i18next';

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { ImageUploadButton, type UploadFile } from '@/components/common/ImageUploadButton';

export function EmptyPhoto({ children }: { children?: React.ReactNode }) {
  const { t } = useTranslation();

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <IconCloud />
        </EmptyMedia>
        <EmptyTitle>{t('images.emptyTitle')}</EmptyTitle>
        <EmptyDescription>
          {t('images.emptyDescription')}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        {children}
      </EmptyContent>
    </Empty>
  )
}
