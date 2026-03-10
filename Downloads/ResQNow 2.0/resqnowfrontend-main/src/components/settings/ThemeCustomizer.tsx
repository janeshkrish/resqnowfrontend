import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useTheme } from "@/components/item-providers/ThemeProvider"
import { Moon, Sun, Laptop } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ThemeCustomizerProps {
  onThemeChange?: (theme: "light" | "dark" | "system") => void
}

const ThemeCustomizer = ({ onThemeChange }: ThemeCustomizerProps) => {
  const { setTheme, theme } = useTheme()
  const applyTheme = (nextTheme: "light" | "dark" | "system") => {
    setTheme(nextTheme)
    onThemeChange?.(nextTheme)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Theme Customization</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Theme Preference</Label>
          <div className="flex gap-2">
            <Button
              variant={theme === "light" ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => applyTheme("light")}
            >
              <Sun className="mr-2 h-4 w-4" />
              Light
            </Button>
            <Button
              variant={theme === "dark" ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => applyTheme("dark")}
            >
              <Moon className="mr-2 h-4 w-4" />
              Dark
            </Button>
            <Button
              variant={theme === "system" ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => applyTheme("system")}
            >
              <Laptop className="mr-2 h-4 w-4" />
              System
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="dark-mode">Dark Mode Toggle</Label>
            <p className="text-xs text-muted-foreground">Force dark mode on/off</p>
          </div>
          <Switch
            id="dark-mode"
            checked={theme === "dark"}
            onCheckedChange={(checked) => applyTheme(checked ? "dark" : "light")}
          />
        </div>
      </CardContent>
    </Card>
  )
}

export default ThemeCustomizer
