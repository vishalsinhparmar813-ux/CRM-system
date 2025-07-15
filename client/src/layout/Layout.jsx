import React, { useEffect, Suspense, useRef } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Header from "@/components/partials/header";
import Sidebar from "@/components/partials/sidebar";
import useWidth from "@/hooks/useWidth";
import useSidebar from "@/hooks/useSidebar";
import useContentWidth from "@/hooks/useContentWidth";
import useMenulayout from "@/hooks/useMenulayout";
import useMenuHidden from "@/hooks/useMenuHidden";
import Footer from "@/components/partials/footer";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import MobileMenu from "../components/partials/sidebar/MobileMenu";
import useMobileMenu from "@/hooks/useMobileMenu";
// import MobileFooter from "@/components/partials/footer/MobileFooter";
import { ToastContainer } from "react-toastify";
import Loading from "@/components/Loading";

const Layout = () => {
    const { width, breakpoints } = useWidth();
    const [collapsed] = useSidebar();

    const switchHeaderClass = () => {
        if (menuType === "horizontal" || menuHidden) {
            return "ltr:ml-0 rtl:mr-0";
        } else if (collapsed) {
            return "ltr:ml-[72px] rtl:mr-[72px]";
        } else {
            return "ltr:ml-[248px] rtl:mr-[248px]";
        }
    };
    // content width
    const [contentWidth] = useContentWidth();
    const [menuType] = useMenulayout();
    const [menuHidden] = useMenuHidden();
    // mobile menu
    const [mobileMenu, setMobileMenu] = useMobileMenu();

    return (
        <>
            <ToastContainer style={{ zIndex: 1000 }}/>
            <Header className={width >= breakpoints.xl ? switchHeaderClass() : ""} />
            {menuType === "vertical" && width >= breakpoints.xl && !menuHidden && <Sidebar />}

            <MobileMenu
                className={`${
                    width < breakpoints.xl && mobileMenu
                        ? "left-0 visible opacity-100  z-[9999]"
                        : "left-[-300px] invisible opacity-0  z-[-999] "
                }`}
            />

            {width < breakpoints.xl && mobileMenu && (
                <div
                    className="overlay bg-slate-900/50 backdrop-filter backdrop-blur-sm opacity-100 fixed inset-0 z-[999]"
                    onClick={() => setMobileMenu(false)}
                ></div>
            )}

            <div
                className={`content-wrapper transition-all duration-150 ${
                    width >= breakpoints.xl ? switchHeaderClass() : ""
                }`}
            >
                <div className="page-content   page-min-height  ">
                    <div className={"container-fluid"}>
                        <Suspense fallback={<Loading />}>
                            {/* <Breadcrumbs /> */}
                            {<Outlet />}
                        </Suspense>
                    </div>
                </div>
            </div>

            <Footer />
        </>
    );
};

export default Layout;
