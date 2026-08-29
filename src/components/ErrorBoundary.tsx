import { Component, type ErrorInfo, type ReactNode } from "react"
import { Button } from "@/components/ui/button"

interface ErrorBoundaryState {
  error: Error | null
}

/** 兜底错误边界：避免任何未捕获异常导致整页白屏 */
export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("页面出错：", error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-center">
          <h1 className="text-lg font-semibold">页面出错了</h1>
          <p className="text-muted-foreground text-sm">{this.state.error.message}</p>
          <Button onClick={() => this.setState({ error: null })}>重试</Button>
        </div>
      )
    }
    return this.props.children
  }
}
