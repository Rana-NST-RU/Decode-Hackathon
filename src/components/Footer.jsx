import { motion } from 'framer-motion';

export const Footer = () => {
  return (
    <motion.footer
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    >
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Built for maintainers, by the community
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            ©️ 2025 FlowForge Labs
          </div>
        </div>
      </div>
    </motion.footer>
  );
};
