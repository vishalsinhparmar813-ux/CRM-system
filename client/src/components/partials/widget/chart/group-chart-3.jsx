import React from "react";
import shade1 from "@/assets/images/all-img/shade-1.png";
import shade2 from "@/assets/images/all-img/shade-2.png";
import shade3 from "@/assets/images/all-img/shade-3.png";
import shade4 from "@/assets/images/all-img/shade-4.png";

const statistics = [
  {
    title1: "Total Sales in USD",
    count1: "$86,954",
    title2: "Total Sales in $RCOF",
    count2: "86,954 $RCOF",
    bg: "bg-warning-500",
    text: "text-primary-500",
    img: shade1,
  },
  {
    title1: "Total Sales - Stage 2",
    count1: "$46,954",
    title2: "Total Sales",
    count2: "$86,954 $RCOF",
    bg: "bg-info-500",
    text: "text-primary-500",
    img: shade2,
  },
  {
    title1: "Total Users",
    count1: "4906",
    title2: "Active Users",
    count2: "3906",
    bg: "bg-primary-500",
    text: "text-danger-500",
    img: shade3,
  },
  {
    title1: "Current Stage",
    count1: "2",
    title2: "Price",
    count2: "$0.22",
    bg: "bg-success-500",
    text: "text-primary-500",
    img: shade4,
  },
];
const GroupChart3 = () => {
  return (
    <>
      {statistics.map((item, i) => (
        <div
          key={i}
          className={`${item.bg} rounded-md p-4 bg-opacity-[0.15] dark:bg-opacity-25 relative z-[1]`}
        >
          <div className="overlay absolute left-0 top-0 w-full h-full z-[-1]">
            <img
              src={item.img}
              alt=""
              draggable="false"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex xl:flex-col flex-row gap-5">
            <div className="lg:w-full w-[50%]">
              <span className="block mb-1 text-sm text-slate-900 dark:text-white font-medium">
                {item.title1}
              </span>
              <span className="block text-xl text-slate-900 dark:text-white font-medium ">
                {item.count1}
              </span>
            </div>

            <div className="lg:w-full w-[50%]">
              <span className="block mb-1 text-sm text-slate-900 dark:text-white font-medium">
                {item.title2}
              </span>
              <span className="block text-xl text-slate-900 dark:text-white font-medium ">
                {item.count2}
              </span>
            </div>
          </div>
          
        </div>
      ))}
    </>
  );
};

export default GroupChart3;
