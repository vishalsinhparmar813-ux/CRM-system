import { useMemo } from "react";
import shade1 from "@/assets/images/all-img/shade-1.png";
import shade2 from "@/assets/images/all-img/shade-2.png";
import shade3 from "@/assets/images/all-img/shade-3.png";
import shade4 from "@/assets/images/all-img/shade-4.png";

const Statistics = ({ data }) => {
  const stats = useMemo(
    () => [
      {
        title1: "Total Players",
        count1: data?.totalUsers?.toLocaleString(),
        bg: "bg-danger-500",
        text: "text-primary-500",
        img: shade1,
      },
      {
        title1: "Online Players",
        count1: data?.onlineUsers?.toLocaleString(),
        bg: "bg-primary-500",
        text: "text-primary-500",
        img: shade2,
      },
      {
        title1: "Total Referrals",
        count1: data?.totalReferrals?.toLocaleString(),
        bg: "bg-success-500",
        text: "text-primary-500",
        img: shade3,
      },
      {
        title1: "Premium Users",
        count1: data?.totalPremiumUsers?.toLocaleString(),
        bg: "bg-warning-500",
        text: "text-danger-500",
        img: shade1,
      },
      {
        title1: "Daily Players",
        count1: data?.dailyUsers?.toLocaleString(),
        bg: "bg-success-500",
        text: "text-danger-500",
        img: shade2,
      },
      {
        title1: "Total Balance",
        count1: data?.totalTaps?.toLocaleString(),
        bg: "bg-warning-500",
        text: "text-danger-500",
        img: shade3,
      },
    ],
    [data]
  );

  return (
    <>
      {stats?.map((item, i) => (
        <div key={i} className={`${item?.bg} rounded-md p-4 bg-opacity-25 relative z-[1]`}>
          <div className="overlay absolute left-0 top-0 w-full h-full z-[-1]">
            <img src={item?.img} alt="" draggable="false" className="w-full h-full object-contain" />
          </div>
          <div className="flex xl:flex-col min-[420px]:flex-row flex-col gap-5">
            <div className="lg:w-full w-[50%]">
              <span className="block mb-1 text-sm text-white font-medium">{item?.title1}</span>
              <span className="block text-xl text-white font-medium">{item?.count1}</span>
            </div>
          </div>
        </div>
      ))}
    </>
  );
};

export default Statistics;
