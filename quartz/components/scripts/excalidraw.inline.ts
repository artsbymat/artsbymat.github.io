const MESSAGES = {
  enlarge: "Click and hold to enlarge. SHIFT + wheel to zoom. ESC to reset. Light mode only.",
  collapse: "ESC to reset. Click and hold to collapse. SHIFT + wheel to zoom. Light mode only.",
} as const

const ZOOM = {
  MIN: 0.1,
  THRESHOLD_1: 4,
  THRESHOLD_2: 6,
  THRESHOLD_3: 10,
  DELTA_1: 0.1,
  DELTA_2: 0.2,
  DELTA_3: 0.3,
  DELTA_4: 0.4,
} as const

const BASE_URL = `${window.location.origin}/`

// Device Detection
const getDeviceType = () => {
  const userAgent = navigator.userAgent
  const mobileKeywords = ["Mobile", "Android", "iPhone", "iPad", "Windows Phone"]
  const isMobile = mobileKeywords.some((keyword) => userAgent.includes(keyword))
  const isTablet = /iPad/i.test(userAgent) || (isMobile && !/Mobile/i.test(userAgent))
  return {
    isDesktop: !isMobile && !isTablet,
    isMobile,
    isTablet,
  }
}

const { isDesktop } = getDeviceType()

const getZoomDelta = (currentZoom: number) => {
  if (currentZoom > ZOOM.THRESHOLD_3) return ZOOM.DELTA_4
  if (currentZoom > ZOOM.THRESHOLD_2) return ZOOM.DELTA_3
  if (currentZoom > ZOOM.THRESHOLD_1) return ZOOM.DELTA_2
  return ZOOM.DELTA_1
}

const togglePointerEvents = (svg: HTMLElement, enable: boolean) => {
  svg.querySelectorAll("a").forEach((el) => {
    ;(el as HTMLElement).style.pointerEvents = enable ? "all" : "none"
  })
}

const initializeViewer = (container: HTMLElement) => {
  const svgElement = container.querySelector(".excalidraw-svg") as HTMLElement | null
  if (!svgElement) return

  container.classList.add("excalidraw-svg")
  svgElement.removeAttribute("width")
  svgElement.removeAttribute("height")

  const state = {
    isEnlarged: false,
    isPanning: false,
    isReadyToPan: false,
    zoomLevel: 1,
    pan: { x: 0, y: 0 },
    startPan: { x: 0, y: 0 },
  }

  let timeoutId: number | null = null
  let textDiv: HTMLDivElement | null = null

  const clearEnlargeTimeout = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  const applyTransform = () => {
    svgElement.style.transform = `scale(${state.zoomLevel}) translate(${state.pan.x}px, ${state.pan.y}px)`
    clearEnlargeTimeout()
  }

  const resetView = () => {
    togglePointerEvents(svgElement, true)
    state.isEnlarged = false
    state.isPanning = false
    state.isReadyToPan = false
    state.zoomLevel = 1
    state.pan = { x: 0, y: 0 }

    container.classList.remove("enlarged")
    if (textDiv) textDiv.textContent = MESSAGES.enlarge
    applyTransform()
  }

  const handleLinkClick = (e: MouseEvent, href: string) => {
    e.preventDefault()
    e.stopPropagation()
    const url = new URL(href, window.location.toString())

    if (url.origin === window.location.origin) {
      const win = window as any
      if (win.spaNavigate) {
        win.spaNavigate(url)
      } else {
        window.location.href = url.toString()
      }
      if (isDesktop) resetView()
    } else {
      window.open(url.toString(), "_blank")
    }
  }

  const setupLinks = () => {
    const links = svgElement.querySelectorAll("a")
    links.forEach((link) => {
      const href = link.getAttribute("href")
      if (!href || href.startsWith("#")) return

      link.addEventListener("click", (e) => handleLinkClick(e, href))
    })
  }

  const setupZoom = () => {
    svgElement.addEventListener(
      "wheel",
      (event: WheelEvent) => {
        if (!event.shiftKey) return
        event.preventDefault()

        const delta = getZoomDelta(state.zoomLevel)
        if (event.deltaY > 0) {
          state.zoomLevel -= delta
        } else {
          state.zoomLevel += delta
        }

        state.zoomLevel = Math.max(ZOOM.MIN, state.zoomLevel)
        applyTransform()
      },
      { passive: false },
    )
  }

  const setupPan = () => {
    svgElement.addEventListener("mousedown", (event: MouseEvent) => {
      state.isReadyToPan = true
      state.startPan = { x: event.clientX, y: event.clientY }
    })

    svgElement.addEventListener("mousemove", (event: MouseEvent) => {
      const deltaX = event.clientX - state.startPan.x
      const deltaY = event.clientY - state.startPan.y
      const distance = Math.sqrt(deltaX ** 2 + deltaY ** 2)

      if (state.isReadyToPan && distance > 20) {
        if (!state.isPanning) {
          togglePointerEvents(svgElement, false)
          state.isPanning = true
        }

        state.pan.x += deltaX / state.zoomLevel
        state.pan.y += deltaY / state.zoomLevel
        state.startPan = { x: event.clientX, y: event.clientY }

        applyTransform()
      }
    })

    const stopPanning = () => {
      togglePointerEvents(svgElement, true)
      state.isPanning = false
      state.isReadyToPan = false
    }

    svgElement.addEventListener("mouseup", stopPanning)
    svgElement.addEventListener("mouseleave", stopPanning)
  }

  const setupEnlarge = () => {
    if (!isDesktop) return

    textDiv = document.createElement("div")
    textDiv.className = "text"
    textDiv.textContent = MESSAGES.enlarge
    container.appendChild(textDiv)

    svgElement.addEventListener("mouseup", clearEnlargeTimeout)
    svgElement.addEventListener("mousedown", () => {
      timeoutId = window.setTimeout(() => {
        timeoutId = null
        if (state.isPanning) return
        state.isReadyToPan = false

        if (state.isEnlarged) {
          container.classList.remove("enlarged")
          if (textDiv) textDiv.textContent = MESSAGES.enlarge
        } else {
          container.classList.add("enlarged")
          if (textDiv) textDiv.textContent = MESSAGES.collapse
        }
        state.isEnlarged = !state.isEnlarged
      }, 1000)
    })

    // Reset on Escape
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") resetView()
    })
  }

  // Initialize
  setupLinks()
  setupZoom()
  setupPan()
  setupEnlarge()
  if (state.zoomLevel !== 1 || state.pan.x !== 0 || state.pan.y !== 0) {
    applyTransform()
  }
}

const normalizeContent = (svgContainer: HTMLElement) => {
  const anchors = svgContainer.querySelectorAll<HTMLAnchorElement>(
    `a[href^="obsidian://open?vault="]`,
  )
  anchors.forEach((el) => {
    const href = el.getAttribute("href")
    if (href) {
      const decodedHref = decodeURIComponent(href)
      el.setAttribute("href", decodedHref.replace(/.*&file=/, BASE_URL).replaceAll(" ", "-"))
      el.classList.add("internal")
    }
  })

  const iframes = svgContainer.querySelectorAll<HTMLIFrameElement>(
    `iframe[src^="obsidian://open?vault="]`,
  )
  iframes.forEach((el) => {
    const src = el.getAttribute("src")
    if (src) {
      const decodedSrc = decodeURIComponent(src)
      el.setAttribute("src", decodedSrc.replace(/.*&file=/, BASE_URL).replaceAll(" ", "-"))
    }
  })

  const youtubeEmbeds = svgContainer.querySelectorAll<HTMLIFrameElement>(
    `iframe[src^="https://releases.obsidian.md/youtube?v="]`,
  )
  youtubeEmbeds.forEach((el) => {
    const src = el.getAttribute("src")
    if (!src) return

    try {
      const url = new URL(src)
      const videoId = url.searchParams.get("v")
      if (videoId) {
        el.setAttribute("src", `https://www.youtube.com/embed/${videoId}`)
        el.setAttribute("title", "YouTube video player")
        el.setAttribute(
          "allow",
          "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
        )
        el.setAttribute("referrerpolicy", "strict-origin-when-cross-origin")
        el.setAttribute("allowfullscreen", "")
      }
    } catch (e) {
      console.error("Failed to parse YouTube URL", e)
    }
  })
}

const processImage = async (img: HTMLImageElement) => {
  if (!img.parentElement) return

  if (img.dataset.noExcalidraw === "true") return
  const closestPopover = img.closest(".popover-inner[data-no-excalidraw]")
  if (closestPopover) return

  const svgURL = img.src
  const parent = img.parentElement
  const isParentP = parent.tagName === "P"

  try {
    const response = await fetch(svgURL)
    if (!response.ok) throw new Error("Failed to fetch SVG")

    const svgContent = await response.text()
    const svgContainer = document.createElement("div")
    svgContainer.innerHTML = svgContent

    normalizeContent(svgContainer)

    if (isParentP) {
      parent.replaceWith(svgContainer)
    } else {
      img.replaceWith(svgContainer)
    }

    initializeViewer(svgContainer)
  } catch (error) {
    console.error(`Error processing Excalidraw SVG: ${error}`)
  }
}

const setupMutationObserver = () => {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== "childList") continue

      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement) || node.tagName === "SCRIPT") return

        if (node instanceof HTMLImageElement && node.src.endsWith(".excalidraw.svg")) {
          processImage(node)
        } else {
          node.querySelectorAll(`img[src$=".excalidraw.svg"]`).forEach((img) => {
            processImage(img as HTMLImageElement)
          })
        }
      })
    }
  })

  observer.observe(document.body, { childList: true, subtree: true })
}

document.querySelectorAll(`img[src$=".excalidraw.svg"]`).forEach((img) => {
  processImage(img as HTMLImageElement)
})

setupMutationObserver()
