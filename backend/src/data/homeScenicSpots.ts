export type HomeScenicSpotHeightVariant = 'short' | 'medium' | 'tall'

export type HomeScenicSpotDetail = {
  overview: string
  averageTemperature: string
  visitRecommendation: string
  photoSpots: string[]
  ticketPrice: string
  openingHours: string
}

export type HomeScenicSpot = {
  id: string
  name: string
  city: string
  province: string
  imageUrl: string
  description: string
  tags: string[]
  heightVariant: HomeScenicSpotHeightVariant
  detail: HomeScenicSpotDetail
}

type ScenicSpotSeed = readonly [
  name: string,
  city: string,
  province: string,
  tags: readonly [string, string, string],
  focus: string,
]

const scenicImageUrlsByName: Record<string, string> = {
  长城:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/The_Great_Wall_of_China_at_Jinshanling-edit.jpg/1280px-The_Great_Wall_of_China_at_Jinshanling-edit.jpg',
  故宫博物院:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Forbidden_City_Beijing_Shenwumen_Gate.JPG/1280px-Forbidden_City_Beijing_Shenwumen_Gate.JPG',
  颐和园:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/%E9%A2%90%E5%92%8C%E5%9B%AD%E4%B8%87%E5%AF%BF%E5%B1%B1%E4%BD%9B%E9%A6%99%E9%98%81.jpg/1280px-%E9%A2%90%E5%92%8C%E5%9B%AD%E4%B8%87%E5%AF%BF%E5%B1%B1%E4%BD%9B%E9%A6%99%E9%98%81.jpg',
  天坛:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Temple_of_Heaven_20160323_01.jpg/1280px-Temple_of_Heaven_20160323_01.jpg',
  上海外滩:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/A_picture_from_China_every_day_101.jpg/1280px-A_picture_from_China_every_day_101.jpg',
  东方明珠:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Oriental_Pearl_Tower_in_Shanghai.jpg/1280px-Oriental_Pearl_Tower_in_Shanghai.jpg',
  杭州西湖:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/West_Lake%2C_Hangzhou_2025.jpg/1280px-West_Lake%2C_Hangzhou_2025.jpg',
  乌镇:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/1_wuzhen_aerial_2023.jpg/1280px-1_wuzhen_aerial_2023.jpg',
  千岛湖:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Thousand_Island_Lake.JPG/1280px-Thousand_Island_Lake.JPG',
  普陀山:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/%E5%8D%97%E6%B5%B7%E8%A7%82%E9%9F%B3%E5%83%8F.jpg/1280px-%E5%8D%97%E6%B5%B7%E8%A7%82%E9%9F%B3%E5%83%8F.jpg',
  黄山:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Huangshan_pic_4.jpg/1280px-Huangshan_pic_4.jpg',
  宏村:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Yixian_Hongcun_2016.09.09_18-17-55.jpg/1280px-Yixian_Hongcun_2016.09.09_18-17-55.jpg',
  九华山:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Jiuhuashan_Tiantai.jpg/1280px-Jiuhuashan_Tiantai.jpg',
  鼓浪屿:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/%E9%BC%93%E6%B5%AA%E5%B1%BF_-_panoramio.jpg/1280px-%E9%BC%93%E6%B5%AA%E5%B1%BF_-_panoramio.jpg',
  武夷山:
    'https://commons.wikimedia.org/wiki/Special:FilePath/Wuyi%20Mountains%20Sea%20of%20clouds%204.jpg',
  三坊七巷:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/%E4%B8%9C%E7%99%BE%E4%B8%AD%E5%BF%83A%E9%A6%8610%E6%A5%BC%E7%9E%AD%E6%9C%9B%E5%8F%B0%E8%A5%BF%E4%B8%89%E5%9D%8A%E4%B8%83%E5%B7%B7.jpg/1280px-%E4%B8%9C%E7%99%BE%E4%B8%AD%E5%BF%83A%E9%A6%8610%E6%A5%BC%E7%9E%AD%E6%9C%9B%E5%8F%B0%E8%A5%BF%E4%B8%89%E5%9D%8A%E4%B8%83%E5%B7%B7.jpg',
  张家界国家森林公园:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/1_tianzishan_wulingyuan_zhangjiajie_2012.jpg/1280px-1_tianzishan_wulingyuan_zhangjiajie_2012.jpg',
  凤凰古城:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Fenghuang_County%2C_Hunan%2C_China%2C_21_December_2016a.jpg/1280px-Fenghuang_County%2C_Hunan%2C_China%2C_21_December_2016a.jpg',
  岳麓山:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/%E5%B2%B3%E9%BA%93%E5%B1%B1_%E6%A9%98%E5%AD%90%E6%B4%B2.jpg/1280px-%E5%B2%B3%E9%BA%93%E5%B1%B1_%E6%A9%98%E5%AD%90%E6%B4%B2.jpg',
  橘子洲:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/%E6%A9%98%E5%AD%90%E6%B4%B2_1.jpg/1280px-%E6%A9%98%E5%AD%90%E6%B4%B2_1.jpg',
  桂林漓江:
    'https://upload.wikimedia.org/wikipedia/commons/2/21/%E6%BC%93%E6%B1%9F%E5%B1%B1%E6%B0%B4.jpg',
  阳朔西街:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Xijie-m.jpg/1280px-Xijie-m.jpg',
  德天跨国瀑布:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/%E5%BE%9E%E4%B8%AD%E5%9C%8B%E5%A2%83%E5%85%A7%E8%A7%80%E7%9C%8B%E7%9A%84%E5%BE%B7%E5%A4%A9%E7%80%91%E5%B8%83.jpg/1280px-%E5%BE%9E%E4%B8%AD%E5%9C%8B%E5%A2%83%E5%85%A7%E8%A7%80%E7%9C%8B%E7%9A%84%E5%BE%B7%E5%A4%A9%E7%80%91%E5%B8%83.jpg',
  北海银滩:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/BeiHaiYanTan.jpg/1280px-BeiHaiYanTan.jpg',
  丽江古城:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e2/1_lijiang_old_town_2012a.jpg/1280px-1_lijiang_old_town_2012a.jpg',
  玉龙雪山:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Yulong_mount.jpg/1280px-Yulong_mount.jpg',
  大理古城:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/%E5%A4%A7%E7%90%86%E5%8F%A4%E5%9F%8E_-_%E8%88%AA%E6%8B%8D_-_2024-10-13_02.jpg/1280px-%E5%A4%A7%E7%90%86%E5%8F%A4%E5%9F%8E_-_%E8%88%AA%E6%8B%8D_-_2024-10-13_02.jpg',
  洱海:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/%E6%B4%B1%E6%B5%B7%E4%B8%8B%E5%92%8C%E6%B9%BE%E6%B9%BF%E5%9C%B0%E5%85%AC%E5%9B%AD_2025-07-24_01.jpg/1280px-%E6%B4%B1%E6%B5%B7%E4%B8%8B%E5%92%8C%E6%B9%BE%E6%B9%BF%E5%9C%B0%E5%85%AC%E5%9B%AD_2025-07-24_01.jpg',
  普达措国家公园:
    'https://commons.wikimedia.org/wiki/Special:FilePath/Meadow%20in%20Pudacuo.JPG',
  西双版纳热带植物园:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Tropical_Botanical_Garden%2C_Xishuangbanna_-_panoramio_-_Colin_W_%281%29.jpg/1280px-Tropical_Botanical_Garden%2C_Xishuangbanna_-_panoramio_-_Colin_W_%281%29.jpg',
  九寨沟:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/1_jiuzhaigou_valley_wu_hua_hai_2011b.jpg/1280px-1_jiuzhaigou_valley_wu_hua_hai_2011b.jpg',
  黄龙:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/1_huanglong_aerial_pano_2023.jpg/1280px-1_huanglong_aerial_pano_2023.jpg',
  峨眉山: 'https://upload.wikimedia.org/wikipedia/commons/8/83/EmeiShanTop.jpg',
  乐山大佛:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Leshan_Buddha_Statue_View.JPG/1280px-Leshan_Buddha_Statue_View.JPG',
  都江堰:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/36661-Dujiangyan_%2844634340644%29.jpg/1280px-36661-Dujiangyan_%2844634340644%29.jpg',
  稻城亚丁:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Yading_Jampelyang-Yangmaiyong.jpg/1280px-Yading_Jampelyang-Yangmaiyong.jpg',
  洪崖洞:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/202308_Hongya_Cave_at_night_from_Qiansimen_Bridge.jpg/1280px-202308_Hongya_Cave_at_night_from_Qiansimen_Bridge.jpg',
  武隆喀斯特:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/Wulongtianshengsanqiao.JPG/1280px-Wulongtianshengsanqiao.JPG',
  解放碑:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Jiefangbei_at_Night_20201024.jpg/1280px-Jiefangbei_at_Night_20201024.jpg',
  秦始皇帝陵博物院:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/%E7%A7%A6%E5%A7%8B%E7%9A%87%E5%B8%9D%E9%99%B5%C2%B7%E7%A7%A6%E5%A7%8B%E7%9A%87%E9%99%B5%C2%B7%E8%A5%BF%E5%AE%89%E8%87%A8%E6%BD%BC%C2%B7%EF%BC%88%E5%B0%81%E5%9C%9F%E6%AD%A3%E5%8C%97%E5%81%B4%EF%BC%89.jpg/1280px-%E7%A7%A6%E5%A7%8B%E7%9A%87%E5%B8%9D%E9%99%B5%C2%B7%E7%A7%A6%E5%A7%8B%E7%9A%87%E9%99%B5%C2%B7%E8%A5%BF%E5%AE%89%E8%87%A8%E6%BD%BC%C2%B7%EF%BC%88%E5%B0%81%E5%9C%9F%E6%AD%A3%E5%8C%97%E5%81%B4%EF%BC%89.jpg',
  大雁塔:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Giant_Wild_Goose_Pagoda.jpg/1280px-Giant_Wild_Goose_Pagoda.jpg',
  华山:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/1_mount_hua_shan_china_2011.jpg/1280px-1_mount_hua_shan_china_2011.jpg',
  延安宝塔山:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/Baota_Mountain_5.jpg/1280px-Baota_Mountain_5.jpg',
  敦煌莫高窟:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Dunhuang_Mogao_Ku_2013.12.31_12-30-18.jpg/1280px-Dunhuang_Mogao_Ku_2013.12.31_12-30-18.jpg',
  鸣沙山月牙泉:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Crescent_Lake_from_the_Singing_Sand_Dunes_%2820230918101214%29.jpg/1280px-Crescent_Lake_from_the_Singing_Sand_Dunes_%2820230918101214%29.jpg',
  张掖七彩丹霞:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Zhangye_Danxia.JPG/1280px-Zhangye_Danxia.JPG',
  嘉峪关关城:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/Jiayuguan_20151012.jpg/1280px-Jiayuguan_20151012.jpg',
  青海湖: 'https://upload.wikimedia.org/wikipedia/commons/6/6f/Qinghai_lake.jpg',
  茶卡盐湖:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Chaqia_Salt_Lake.JPG/1280px-Chaqia_Salt_Lake.JPG',
  塔尔寺:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Taersi.jpg/1280px-Taersi.jpg',
  布达拉宫:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/Potala_palace23.jpg/1280px-Potala_palace23.jpg',
  大昭寺:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Jokhang_Temple_Lhasa_Tibet_China_%E8%A5%BF%E8%97%8F_%E6%8B%89%E8%90%A8_%E5%A4%A7%E6%98%AD%E5%AF%BA_-_panoramio_%285%29.jpg/1280px-Jokhang_Temple_Lhasa_Tibet_China_%E8%A5%BF%E8%97%8F_%E6%8B%89%E8%90%A8_%E5%A4%A7%E6%98%AD%E5%AF%BA_-_panoramio_%285%29.jpg',
  纳木错:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Namtso-and-holy-rock.jpg/1280px-Namtso-and-holy-rock.jpg',
  珠峰大本营:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Khumbutse.jpg/1280px-Khumbutse.jpg',
  喀纳斯: 'https://upload.wikimedia.org/wikipedia/commons/6/6f/Kanas_Lake%2C_China%2C_LandSat_image.jpg',
  天山天池:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/%E5%A4%A9%E5%B1%B1%E5%A4%A9%E6%B1%A02_-_panoramio.jpg/1280px-%E5%A4%A9%E5%B1%B1%E5%A4%A9%E6%B1%A02_-_panoramio.jpg',
  赛里木湖: 'https://upload.wikimedia.org/wikipedia/commons/7/7b/Satellite_Image_of_Lake_Sayram.png',
  那拉提草原:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Nalati_Grassland_2.jpg/1280px-Nalati_Grassland_2.jpg',
  火焰山:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/%E7%81%AB%E7%84%B0%E5%B1%B1%E4%B8%AD%E6%99%AF.jpg/1280px-%E7%81%AB%E7%84%B0%E5%B1%B1%E4%B8%AD%E6%99%AF.jpg',
  呼伦贝尔大草原:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Hulunbuir_Grasslands%2C_Inner_Mongolia_-_9758734754.jpg/1280px-Hulunbuir_Grasslands%2C_Inner_Mongolia_-_9758734754.jpg',
  额济纳胡杨林:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Badanjilin.jpg/1280px-Badanjilin.jpg',
  响沙湾:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/%E9%84%82%E5%B0%94%E5%A4%9A%E6%96%AF-%E5%93%8D%E6%B2%99%E6%B9%BE_-_panoramio.jpg/1280px-%E9%84%82%E5%B0%94%E5%A4%9A%E6%96%AF-%E5%93%8D%E6%B2%99%E6%B9%BE_-_panoramio.jpg',
  山海关:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/Shanhaiguan.jpg/1280px-Shanhaiguan.jpg',
  承德避暑山庄:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Chengde_Mountain_Resort_22630-Chengde_%2842954495010%29.jpg/1280px-Chengde_Mountain_Resort_22630-Chengde_%2842954495010%29.jpg',
  白洋淀:
    'https://upload.wikimedia.org/wikipedia/commons/5/5c/%E7%99%BD%E6%B4%8B%E6%B7%80%E6%99%AF%E5%8C%BA%E7%9A%84%E6%99%9A%E9%9C%9E.jpg',
  平遥古城:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Pingyao_40.JPG/1280px-Pingyao_40.JPG',
  云冈石窟:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/61292-Yungang-Grottoes_%2828498548881%29.jpg/1280px-61292-Yungang-Grottoes_%2828498548881%29.jpg',
  五台山:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/Mount_Wutai.JPG/1280px-Mount_Wutai.JPG',
  壶口瀑布:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Hukou_Waterfall.jpg/1280px-Hukou_Waterfall.jpg',
  泰山: 'https://upload.wikimedia.org/wikipedia/commons/7/74/%E6%B3%B0%E5%B1%B1_%E5%8D%97%E5%A4%A9%E9%97%A8.jpg',
  曲阜三孔:
    'https://commons.wikimedia.org/wiki/Special:FilePath/20230612%20Dacheng%20Dian%2C%20Qufu%20Kongmiao.jpg',
  青岛栈桥:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/%E9%9D%92%E5%B2%9B%E6%A0%88%E6%A1%A5_Ehemalige_Landungsbr%C3%BCcke_Qingdao.jpg/1280px-%E9%9D%92%E5%B2%9B%E6%A0%88%E6%A1%A5_Ehemalige_Landungsbr%C3%BCcke_Qingdao.jpg',
  崂山:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/%E5%B4%82%E5%B1%B1.JPG/1280px-%E5%B4%82%E5%B1%B1.JPG',
  南京夫子庙:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/LingXingMen_of_Nanjing_Confucian_Temple.jpg/1280px-LingXingMen_of_Nanjing_Confucian_Temple.jpg',
  苏州园林:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Humble_Administrator%27s_Garden_Suzhou_November_2017_006.jpg/1280px-Humble_Administrator%27s_Garden_Suzhou_November_2017_006.jpg',
  周庄古镇:
    'https://commons.wikimedia.org/wiki/Special:FilePath/Zhouzhuang%202.jpg',
  中山陵: 'https://upload.wikimedia.org/wikipedia/commons/a/aa/Hall_of_Sun_Yat-sen_Mausoleum.jpg',
  庐山:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Mount_Lushan_-_fog.JPG/1280px-Mount_Lushan_-_fog.JPG',
  滕王阁:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/%E6%BB%95%E7%8E%8B%E9%98%81_2024-08-05_04.jpg/1280px-%E6%BB%95%E7%8E%8B%E9%98%81_2024-08-05_04.jpg',
  婺源篁岭:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Huangling_Village.jpg/1280px-Huangling_Village.jpg',
  三清山:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Sanqingshan1522.jpg/1280px-Sanqingshan1522.jpg',
  黄鹤楼:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/CN_-_Hubei_-_Wuhan_-_Kranichpagode.jpg/1280px-CN_-_Hubei_-_Wuhan_-_Kranichpagode.jpg',
  神农架:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/20250524_%E7%A5%9E%E8%BE%B2%E9%A0%82_ShenNong_Ding_%E6%B5%B7%E6%8B%94_Altitude_3106.2_M.jpg/1280px-20250524_%E7%A5%9E%E8%BE%B2%E9%A0%82_ShenNong_Ding_%E6%B5%B7%E6%8B%94_Altitude_3106.2_M.jpg',
  恩施大峡谷:
    'https://upload.wikimedia.org/wikipedia/commons/e/e3/Enshi_Canyon_109.21564E_30.45224N.png',
  三峡大坝:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/ThreeGorgesDam-China2009.jpg/1280px-ThreeGorgesDam-China2009.jpg',
  广州塔:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Canton_Tower_2013.11.15_18-12-45.jpg/1280px-Canton_Tower_2013.11.15_18-12-45.jpg',
  丹霞山:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Yangyuanshi_seen_from_the_back.jpg/1280px-Yangyuanshi_seen_from_the_back.jpg',
  深圳世界之窗:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/WINDOWS_OF_THE_WORLD_SHENZHEN_%2813%29.jpg/1280px-WINDOWS_OF_THE_WORLD_SHENZHEN_%2813%29.jpg',
  珠海长隆海洋王国:
    'https://commons.wikimedia.org/wiki/Special:FilePath/Whale%20Shark%20Aquarium.jpg',
  亚龙湾: 'https://upload.wikimedia.org/wikipedia/commons/f/f2/%E4%BA%9A%E9%BE%99%E6%B9%BE.JPG',
  蜈支洲岛:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Haitang%2C_Sanya%2C_Hainan%2C_China_-_panoramio_%286%29.jpg/1280px-Haitang%2C_Sanya%2C_Hainan%2C_China_-_panoramio_%286%29.jpg',
  海口骑楼老街:
    'https://upload.wikimedia.org/wikipedia/commons/e/e4/Bo%27ai_Road_area_-_01.jpg',
  天津古文化街:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Guwenhuajie_Street_20160823.jpg/1280px-Guwenhuajie_Street_20160823.jpg',
  盘山:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/%E7%9B%98%E5%B1%B1%E9%A1%B6%E5%B3%B0_-_Summit_of_Mount_Panshan_-_2015.10_-_panoramio.jpg/1280px-%E7%9B%98%E5%B1%B1%E9%A1%B6%E5%B3%B0_-_Summit_of_Mount_Panshan_-_2015.10_-_panoramio.jpg',
  沈阳故宫:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/%E6%B2%88%E9%98%B3%E6%95%85%E5%AE%AB%E4%B8%96%E7%95%8C%E6%96%87%E5%8C%96%E9%81%97%E4%BA%A7%E6%A0%87%E5%BF%97.jpg/1280px-%E6%B2%88%E9%98%B3%E6%95%85%E5%AE%AB%E4%B8%96%E7%95%8C%E6%96%87%E5%8C%96%E9%81%97%E4%BA%A7%E6%A0%87%E5%BF%97.jpg',
  大连星海广场:
    'https://commons.wikimedia.org/wiki/Special:FilePath/Xinghai%20Square%20.jpg',
  长白山:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Paektu-san.jpg/1280px-Paektu-san.jpg',
  哈尔滨冰雪大世界:
    'https://upload.wikimedia.org/wikipedia/commons/a/ad/Ice_Snow_World.jpg',
  漠河北极村: 'https://upload.wikimedia.org/wikipedia/commons/a/a6/Zuibeikun530.png',
  黄果树瀑布:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/HuangguoshuFall.jpg/1280px-HuangguoshuFall.jpg',
}

const fallbackScenicImageUrl =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/The_Great_Wall_of_China_at_Jinshanling-edit.jpg/1280px-The_Great_Wall_of_China_at_Jinshanling-edit.jpg'

const heightVariants = [
  'tall',
  'medium',
  'short',
  'medium',
  'tall',
  'short',
] as const

const provinceClimateSummaries: Record<string, string> = {
  北京市: '年均约 12℃，春秋舒适，冬季偏冷且风感明显',
  上海市: '年均约 17℃，春秋最舒服，夏季湿热、冬季湿冷',
  浙江省: '年均约 16-18℃，春秋适合慢游，夏季注意防晒和阵雨',
  安徽省: '年均约 15-17℃，山地早晚偏凉，春秋登临体验更稳定',
  福建省: '年均约 18-21℃，湿润温和，夏季海风和阵雨较多',
  湖南省: '年均约 16-18℃，春秋适合户外，夏季湿热',
  广西壮族自治区: '年均约 19-22℃，冬季温和，夏季湿热多雨',
  云南省: '年均约 13-18℃，日温差明显，高海拔区域早晚偏冷',
  四川省: '年均约 12-18℃，平原温润，山地和高原温差较大',
  重庆市: '年均约 18℃，春秋宜行，夏季闷热、夜游更舒适',
  陕西省: '年均约 12-15℃，春秋舒适，山地早晚温差较大',
  甘肃省: '年均约 8-12℃，空气干爽，昼夜温差明显',
  青海省: '年均约 0-8℃，高原凉爽，紫外线强且早晚冷',
  西藏自治区: '年均约 4-10℃，日照强、昼夜温差大，需预留适应时间',
  新疆维吾尔自治区: '年均约 6-12℃，昼夜温差大，夏季日照强',
  内蒙古自治区: '年均约 3-8℃，风大干燥，草原夏季凉爽',
  河北省: '年均约 10-13℃，春秋宜行，夏季沿海和山区更舒适',
  山西省: '年均约 8-12℃，空气偏干，早晚温差明显',
  山东省: '年均约 12-14℃，沿海风感明显，春秋最适合漫游',
  江苏省: '年均约 15-17℃，春秋舒适，梅雨季湿度较高',
  江西省: '年均约 17-19℃，春秋适合摄影，夏季湿热',
  湖北省: '年均约 16-18℃，春秋适合户外，夏季湿热',
  广东省: '年均约 21-23℃，全年温暖，夏季湿热并有阵雨',
  海南省: '年均约 23-26℃，全年温暖，夏秋需关注台风和降雨',
  天津市: '年均约 12℃，春秋舒适，冬季偏冷且风感明显',
  辽宁省: '年均约 8-11℃，沿海夏季舒适，冬季寒冷',
  吉林省: '年均约 3-6℃，夏季凉爽，冬季严寒且雪景突出',
  黑龙江省: '年均约 2-5℃，冬季严寒，冰雪季需要保暖装备',
  贵州省: '年均约 14-16℃，夏季清凉，山地多雾多雨',
}

const highAltitudeSpotClimateSummaries: Record<string, string> = {
  玉龙雪山: '山地年均约 5-12℃，海拔升高后体感明显转冷',
  普达措国家公园: '高原年均约 6-10℃，早晚偏冷，雨季需备防水外套',
  稻城亚丁: '高原年均约 4-10℃，昼夜温差大，徒步需保暖和防晒',
  布达拉宫: '拉萨年均约 8℃，日照强，早晚温差明显',
  大昭寺: '拉萨年均约 8℃，日照强，早晚温差明显',
  纳木错: '湖区年均约 0-6℃，风大且早晚寒冷',
  珠峰大本营: '高海拔区域常年偏冷，昼夜温差大，需要充足保暖',
  青海湖: '湖区年均约 4-8℃，夏季凉爽，早晚需外套',
  茶卡盐湖: '盐湖区年均约 4-8℃，日照强，昼夜温差明显',
  天山天池: '山湖年均约 5-9℃，夏季凉爽，冬季寒冷',
  赛里木湖: '湖区年均约 3-8℃，风大且早晚偏冷',
  那拉提草原: '草原年均约 6-10℃，夏季舒适，夜间偏凉',
  长白山: '山地年均约 2-7℃，天气变化快，山顶体感更冷',
}

const noTicketSpotNames = new Set([
  '上海外滩',
  '杭州西湖',
  '三坊七巷',
  '阳朔西街',
  '北海银滩',
  '大理古城',
  '洱海',
  '洪崖洞',
  '解放碑',
  '青海湖',
  '呼伦贝尔大草原',
  '青岛栈桥',
  '南京夫子庙',
  '亚龙湾',
  '海口骑楼老街',
  '天津古文化街',
  '大连星海广场',
])

function hasAnyTag(tags: readonly string[], values: readonly string[]) {
  return values.some((value) => tags.includes(value))
}

function buildAverageTemperature(
  name: string,
  province: string,
): string {
  return (
    highAltitudeSpotClimateSummaries[name] ??
    provinceClimateSummaries[province] ??
    '年均约 12-18℃，春秋出行更稳定，山区和水边早晚会偏凉'
  )
}

function buildVisitRecommendation(
  name: string,
  tags: readonly string[],
): string {
  if (hasAnyTag(tags, ['高原徒步', '挑战', '雪山'])) {
    return `建议安排 1-2 天体验${name}，把交通、适应海拔和核心徒步时间留足。`
  }

  if (hasAnyTag(tags, ['登山', '名山', '云海', '险峰'])) {
    return `建议安排 1-2 天，轻装走核心步道；想看日出云海可在山上或山脚住一晚。`
  }

  if (hasAnyTag(tags, ['主题公园', '亲子', '海洋'])) {
    return `建议安排 1 天，上午入园避开排队高峰，傍晚衔接演出或夜场。`
  }

  if (hasAnyTag(tags, ['夜景', '街区', '古城', '城市漫游', '美食'])) {
    return `建议安排半日到 1 天，下午慢逛，傍晚到夜间留给灯光、街巷和餐饮。`
  }

  if (hasAnyTag(tags, ['博物馆', '石窟艺术', '宫殿建筑', '人文'])) {
    return `建议安排 3-5 小时深度参观，提前梳理展区或讲解路线，避免只打卡主入口。`
  }

  if (hasAnyTag(tags, ['湖泊', '海岛', '草原', '自驾', '亲水'])) {
    return `建议安排 1 天慢游，适合自驾、游船、骑行或沿水岸停留取景。`
  }

  return `建议安排 4-6 小时，按主景观、观景点和周边步道组织轻松动线。`
}

function buildTicketPrice(name: string, tags: readonly string[]) {
  if (noTicketSpotNames.has(name)) {
    return '不用门票；游船、展馆、演出或景区内项目可能单独收费。'
  }

  if (name === '长城') {
    return '参考 40-80 元，缆车、滑车和联票以景区公示为准。'
  }

  if (hasAnyTag(tags, ['主题公园', '海洋'])) {
    return '参考 220-450 元，夜场、快速通道和套票以景区公示为准。'
  }

  if (
    hasAnyTag(tags, ['名山', '登山', '雪山', '峡谷', '丹霞', '瀑布']) ||
    name.includes('山')
  ) {
    return '参考 80-260 元，索道、观光车和联票通常需另行核对。'
  }

  if (hasAnyTag(tags, ['博物馆', '宫殿建筑', '石窟艺术'])) {
    return '参考 40-160 元，旺淡季、讲解和特展费用以景区公示为准。'
  }

  if (hasAnyTag(tags, ['世界遗产'])) {
    return '参考 40-200 元，旺淡季、预约和联票规则以景区公示为准。'
  }

  return '参考 30-160 元，具体票种、优惠和预约规则以景区公示为准。'
}

function buildOpeningHours(tags: readonly string[]) {
  if (hasAnyTag(tags, ['夜景', '街区', '古城', '城市漫游', '美食'])) {
    return '街区或公共空间通常全天开放，商铺、灯光和展馆时段以当日公示为准。'
  }

  if (hasAnyTag(tags, ['博物馆', '宫殿建筑', '石窟艺术', '寺院', '祈福'])) {
    return '通常 08:30-17:00 开放，周一闭馆、预约和淡旺季调整需出行前核对。'
  }

  if (hasAnyTag(tags, ['主题公园', '海洋', '亲子'])) {
    return '通常 10:00-21:00 开放，节假日和夜场时段以景区当日公告为准。'
  }

  if (hasAnyTag(tags, ['名山', '登山', '峡谷', '雪山', '瀑布', '高原徒步'])) {
    return '通常 07:00-17:30 开放，索道、区间车和恶劣天气管制需提前确认。'
  }

  return '通常 08:00-18:00 开放，旺淡季、预约和临时管制以景区公示为准。'
}

function buildPhotoSpots(name: string, tags: readonly string[]) {
  const spots = [`${name}主景观位`]

  if (hasAnyTag(tags, ['夜景', '城市天际线', '城市地标'])) {
    spots.push('蓝调时刻灯光视角')
  } else if (hasAnyTag(tags, ['湖泊', '湖景', '海滨', '海岛', '亲水'])) {
    spots.push('水岸倒影与日落视角')
  } else if (hasAnyTag(tags, ['登山', '名山', '雪山', '云海', '峰林'])) {
    spots.push('高处观景台与云海视角')
  } else if (hasAnyTag(tags, ['古城', '古镇', '街区', '徽派古村'])) {
    spots.push('街巷转角与清晨人少视角')
  } else if (hasAnyTag(tags, ['寺院', '祈福', '古建', '宫殿建筑'])) {
    spots.push('中轴线建筑与檐角视角')
  } else {
    spots.push('入口标志与开阔观景视角')
  }

  if (hasAnyTag(tags, ['摄影', '日落', '日出', '秋色'])) {
    spots.push('清晨或日落黄金时段')
  } else if (hasAnyTag(tags, ['亲子', '主题公园'])) {
    spots.push('主题装置与演出结束散场视角')
  } else {
    spots.push('游客动线中段的停留平台')
  }

  spots.push('周边步道或观景平台')

  return Array.from(new Set(spots)).slice(0, 4)
}

function buildSpotDetail(
  [name, city, province, tags, focus]: ScenicSpotSeed,
): HomeScenicSpotDetail {
  return {
    overview: `${name}位于${province}${city}，${focus}。这里适合把「${tags.join('、')}」作为旅行主题，行程上建议留出从容停留时间，少赶点、多观察现场节奏。`,
    averageTemperature: buildAverageTemperature(name, province),
    visitRecommendation: buildVisitRecommendation(name, tags),
    photoSpots: buildPhotoSpots(name, tags),
    ticketPrice: buildTicketPrice(name, tags),
    openingHours: buildOpeningHours(tags),
  }
}

const scenicSpotSeeds: readonly ScenicSpotSeed[] = [
  ['长城', '北京', '北京市', ['世界遗产', '人文历史', '徒步视野'], '适合安排半日到一日的山脊徒步与历史风景线'],
  ['故宫博物院', '北京', '北京市', ['博物馆', '宫殿建筑', '城市漫游'], '适合串联中轴线、宫殿群和老城街巷'],
  ['颐和园', '北京', '北京市', ['皇家园林', '湖景', '轻徒步'], '适合慢节奏环湖、园林观景和亲友结伴游'],
  ['天坛', '北京', '北京市', ['古建', '城市公园', '摄影'], '适合用半日感受礼制建筑与开阔林荫空间'],
  ['上海外滩', '上海', '上海市', ['城市天际线', '夜景', '建筑'], '适合黄浦江两岸步行、拍摄和夜游'],
  ['东方明珠', '上海', '上海市', ['地标', '观景台', '亲子'], '适合俯瞰城市尺度并搭配陆家嘴动线'],
  ['杭州西湖', '杭州', '浙江省', ['城市湖景', '散步', '夜游'], '适合骑行、泛舟和串联经典十景'],
  ['乌镇', '嘉兴', '浙江省', ['江南水乡', '古镇', '夜游'], '适合住一晚感受水巷、戏台和清晨街景'],
  ['千岛湖', '杭州', '浙江省', ['湖岛', '骑行', '亲水'], '适合环湖自驾、岛屿游船和轻松度假'],
  ['普陀山', '舟山', '浙江省', ['海岛', '祈福', '徒步'], '适合海岸步道、寺院参访和慢节奏停留'],
  ['黄山', '黄山', '安徽省', ['世界遗产', '奇松云海', '登山'], '适合两日登山、日出云海和温泉放松'],
  ['宏村', '黄山', '安徽省', ['徽派古村', '摄影', '写生'], '适合清晨入村拍摄水系、白墙和远山'],
  ['九华山', '池州', '安徽省', ['名山', '祈福', '徒步'], '适合山间寺院巡礼与缓坡徒步'],
  ['鼓浪屿', '厦门', '福建省', ['海岛', '万国建筑', '慢游'], '适合无车小岛漫步、海风和音乐氛围'],
  ['武夷山', '南平', '福建省', ['丹霞', '漂流', '茶文化'], '适合竹筏漂流、岩骨花香和山水徒步'],
  ['三坊七巷', '福州', '福建省', ['历史街区', '美食', '城市漫游'], '适合用半日串联古厝、巷弄和闽味小吃'],
  ['张家界国家森林公园', '张家界', '湖南省', ['自然风光', '峰林', '深度游'], '适合两到三天探索峰林、索道和峡谷'],
  ['凤凰古城', '湘西', '湖南省', ['古城', '沱江', '夜景'], '适合临水漫步、吊脚楼摄影和夜游'],
  ['岳麓山', '长沙', '湖南省', ['城市山林', '书院', '徒步'], '适合把自然步道和岳麓书院排进同一天'],
  ['橘子洲', '长沙', '湖南省', ['江洲', '城市夜景', '散步'], '适合傍晚沿江散步并衔接市区美食'],
  ['桂林漓江', '桂林', '广西壮族自治区', ['山水', '摄影', '慢游'], '适合游船、轻徒步和山水画卷式取景'],
  ['阳朔西街', '桂林', '广西壮族自治区', ['街区', '骑行', '夜游'], '适合骑行田园后回到街区吃饭休整'],
  ['德天跨国瀑布', '崇左', '广西壮族自治区', ['瀑布', '边境风光', '自然'], '适合近距离观瀑和喀斯特山水游'],
  ['北海银滩', '北海', '广西壮族自治区', ['海滩', '亲水', '日落'], '适合轻松看海、亲子玩沙和海鲜晚餐'],
  ['丽江古城', '丽江', '云南省', ['古城', '休闲', '雪山'], '适合古城街巷、雪山视野和咖啡小店'],
  ['玉龙雪山', '丽江', '云南省', ['雪山', '索道', '高原'], '适合雪山观景、蓝月谷和高原体验'],
  ['大理古城', '大理', '云南省', ['古城', '市集', '慢游'], '适合把街巷、市集和苍山洱海连成慢行程'],
  ['洱海', '大理', '云南省', ['湖景', '骑行', '度假'], '适合环海骑行、村落停留和日落观景'],
  ['普达措国家公园', '迪庆', '云南省', ['高原湖泊', '森林', '徒步'], '适合高原森林栈道和湖畔轻徒步'],
  ['西双版纳热带植物园', '西双版纳', '云南省', ['热带植物', '亲子', '科普'], '适合雨林植物观察和轻松园区游'],
  ['九寨沟', '阿坝', '四川省', ['彩池', '森林', '世界遗产'], '适合一整天沿沟看湖泊、瀑布和秋色'],
  ['黄龙', '阿坝', '四川省', ['钙化池', '高原', '徒步'], '适合栈道徒步、彩池观景和高原风光'],
  ['峨眉山', '乐山', '四川省', ['名山', '云海', '徒步'], '适合两日登山、金顶日出和温泉休整'],
  ['乐山大佛', '乐山', '四川省', ['石刻', '江景', '人文'], '适合江边游船、栈道和市区美食衔接'],
  ['都江堰', '成都', '四川省', ['水利工程', '古迹', '亲子'], '适合半日了解水利智慧并顺游青城山'],
  ['稻城亚丁', '甘孜', '四川省', ['雪山', '高原徒步', '湖泊'], '适合留足体力做高海拔深度徒步'],
  ['洪崖洞', '重庆', '重庆市', ['山城夜景', '街区', '美食'], '适合夜间观景、步道穿行和江边拍照'],
  ['武隆喀斯特', '重庆', '重庆市', ['喀斯特', '天坑', '峡谷'], '适合峡谷步道、天生桥和自然地貌游'],
  ['解放碑', '重庆', '重庆市', ['商圈', '夜游', '美食'], '适合串联市中心步行、美食和江景夜游'],
  ['秦始皇帝陵博物院', '西安', '陕西省', ['博物馆', '秦文化', '世界遗产'], '适合半日到一日深度了解兵马俑'],
  ['大雁塔', '西安', '陕西省', ['唐风建筑', '夜景', '城市漫游'], '适合夜间广场、博物馆和大唐街区联动'],
  ['华山', '渭南', '陕西省', ['险峰', '登山', '日出'], '适合挑战型登山、索道和云海观景'],
  ['延安宝塔山', '延安', '陕西省', ['红色旅游', '山城', '夜景'], '适合了解革命历史并俯瞰延安城'],
  ['敦煌莫高窟', '酒泉', '甘肃省', ['石窟艺术', '世界遗产', '人文'], '适合预约参观洞窟、壁画和博物馆'],
  ['鸣沙山月牙泉', '敦煌', '甘肃省', ['沙漠', '日落', '骑行'], '适合傍晚看沙丘、泉水和大漠日落'],
  ['张掖七彩丹霞', '张掖', '甘肃省', ['丹霞', '摄影', '日落'], '适合下午到日落时段拍摄彩色丘陵'],
  ['嘉峪关关城', '嘉峪关', '甘肃省', ['关城', '长城文化', '边塞'], '适合串联城楼、戈壁和长城历史'],
  ['青海湖', '海南藏族自治州', '青海省', ['高原湖泊', '骑行', '花海'], '适合环湖自驾、观鸟和夏季花海'],
  ['茶卡盐湖', '海西', '青海省', ['盐湖', '摄影', '天空之镜'], '适合晴天拍摄倒影和高原公路旅行'],
  ['塔尔寺', '西宁', '青海省', ['寺院', '藏传文化', '人文'], '适合半日了解宗教艺术和高原文化'],
  ['布达拉宫', '拉萨', '西藏自治区', ['宫堡建筑', '高原', '世界遗产'], '适合提前预约并慢速适应高原节奏'],
  ['大昭寺', '拉萨', '西藏自治区', ['寺院', '转经', '人文'], '适合串联八廓街感受拉萨日常与信仰'],
  ['纳木错', '那曲', '西藏自治区', ['圣湖', '高原湖泊', '日落'], '适合湖畔观景、星空和高原自驾'],
  ['珠峰大本营', '日喀则', '西藏自治区', ['雪山', '高原公路', '挑战'], '适合做好适应安排后观看世界级雪山'],
  ['喀纳斯', '阿勒泰', '新疆维吾尔自治区', ['湖泊', '森林', '秋色'], '适合深秋摄影、村落停留和湖畔徒步'],
  ['天山天池', '昌吉', '新疆维吾尔自治区', ['高山湖泊', '雪山', '森林'], '适合从乌鲁木齐出发的一日山湖行程'],
  ['赛里木湖', '博尔塔拉', '新疆维吾尔自治区', ['蓝湖', '自驾', '草原'], '适合环湖自驾、花海和雪山远景'],
  ['那拉提草原', '伊犁', '新疆维吾尔自治区', ['草原', '骑马', '自驾'], '适合夏季草原、河谷和轻户外体验'],
  ['火焰山', '吐鲁番', '新疆维吾尔自治区', ['戈壁', '地貌', '西游文化'], '适合短暂停留并串联葡萄沟和交河故城'],
  ['呼伦贝尔大草原', '呼伦贝尔', '内蒙古自治区', ['草原', '自驾', '亲子'], '适合夏季草原公路、骑马和湿地日落'],
  ['额济纳胡杨林', '阿拉善', '内蒙古自治区', ['胡杨林', '秋色', '摄影'], '适合国庆前后拍摄金色林海'],
  ['响沙湾', '鄂尔多斯', '内蒙古自治区', ['沙漠', '亲子', '度假'], '适合沙漠活动、驼队体验和轻度假'],
  ['山海关', '秦皇岛', '河北省', ['长城入海', '关城', '海滨'], '适合把长城文化和海边休闲排在一起'],
  ['承德避暑山庄', '承德', '河北省', ['皇家园林', '世界遗产', '避暑'], '适合园林漫步和外八庙人文游'],
  ['白洋淀', '保定', '河北省', ['湿地', '游船', '亲子'], '适合夏季荷花、水乡游船和亲子短途'],
  ['平遥古城', '晋中', '山西省', ['古城', '晋商文化', '夜游'], '适合住进城内感受票号、城墙和街巷'],
  ['云冈石窟', '大同', '山西省', ['石窟艺术', '世界遗产', '人文'], '适合半日深度看北魏造像和博物馆'],
  ['五台山', '忻州', '山西省', ['名山', '寺院', '清凉'], '适合多寺院巡游和避暑慢行'],
  ['壶口瀑布', '临汾', '山西省', ['瀑布', '黄河', '摄影'], '适合近距离感受黄河奔涌和峡谷声势'],
  ['泰山', '泰安', '山东省', ['五岳', '登山', '日出'], '适合夜爬日出或索道轻松登顶'],
  ['曲阜三孔', '济宁', '山东省', ['儒家文化', '古建', '研学'], '适合孔府、孔庙、孔林一日人文线'],
  ['青岛栈桥', '青岛', '山东省', ['海滨', '城市漫游', '摄影'], '适合海边散步、老城建筑和啤酒美食'],
  ['崂山', '青岛', '山东省', ['海上名山', '徒步', '道教文化'], '适合山海同框、沿海公路和轻徒步'],
  ['南京夫子庙', '南京', '江苏省', ['秦淮河', '夜游', '美食'], '适合夜游秦淮、街区小吃和历史建筑'],
  ['苏州园林', '苏州', '江苏省', ['古典园林', '世界遗产', '慢游'], '适合用一天串联拙政园、留园和老街'],
  ['周庄古镇', '苏州', '江苏省', ['水乡', '古镇', '亲水'], '适合小桥流水、清晨街巷和夜间灯影'],
  ['中山陵', '南京', '江苏省', ['近代历史', '山林', '建筑'], '适合钟山风景区半日到一日游'],
  ['庐山', '九江', '江西省', ['避暑名山', '云雾', '徒步'], '适合夏季避暑、山间别墅和瀑布线'],
  ['滕王阁', '南昌', '江西省', ['江景', '楼阁', '夜景'], '适合城市地标、赣江夜景和文化参观'],
  ['婺源篁岭', '上饶', '江西省', ['古村', '晒秋', '摄影'], '适合秋季拍摄晒秋和徽派村落'],
  ['三清山', '上饶', '江西省', ['花岗岩峰林', '云海', '徒步'], '适合栈道徒步、日出云海和山岳摄影'],
  ['黄鹤楼', '武汉', '湖北省', ['名楼', '江景', '城市地标'], '适合登楼俯瞰长江并串联户部巷'],
  ['神农架', '神农架林区', '湖北省', ['原始森林', '避暑', '自驾'], '适合森林公路、峡谷和夏季避暑'],
  ['恩施大峡谷', '恩施', '湖北省', ['峡谷', '喀斯特', '徒步'], '适合云龙地缝、绝壁栈道和自然探索'],
  ['三峡大坝', '宜昌', '湖北省', ['工程地标', '江峡', '研学'], '适合了解大型水利工程并顺游三峡'],
  ['广州塔', '广州', '广东省', ['城市地标', '夜景', '观景'], '适合珠江夜游、城市天际线和观景台'],
  ['丹霞山', '韶关', '广东省', ['丹霞地貌', '徒步', '日出'], '适合地貌观察、山间栈道和摄影'],
  ['深圳世界之窗', '深圳', '广东省', ['主题公园', '亲子', '夜场'], '适合亲子游、轻娱乐和夜间演出'],
  ['珠海长隆海洋王国', '珠海', '广东省', ['主题乐园', '亲子', '海洋'], '适合亲子度假、表演和海洋动物展区'],
  ['亚龙湾', '三亚', '海南省', ['海湾', '度假', '亲水'], '适合住酒店、下海和轻松海岛度假'],
  ['蜈支洲岛', '三亚', '海南省', ['海岛', '潜水', '亲水'], '适合水上项目、潜水和清澈海景'],
  ['海口骑楼老街', '海口', '海南省', ['南洋骑楼', '街区', '美食'], '适合半日漫步、咖啡和海南小吃'],
  ['天津古文化街', '天津', '天津市', ['民俗街区', '相声', '小吃'], '适合城市短途、津味小吃和传统工艺'],
  ['盘山', '天津', '天津市', ['山景', '徒步', '京津周边'], '适合周末登山、寺院和北方山水'],
  ['沈阳故宫', '沈阳', '辽宁省', ['宫殿建筑', '清文化', '博物馆'], '适合半日了解关外宫殿与清代历史'],
  ['大连星海广场', '大连', '辽宁省', ['海滨广场', '城市夜景', '散步'], '适合傍晚海边散步和城市观景'],
  ['长白山', '延边', '吉林省', ['天池', '雪山', '森林'], '适合北坡或西坡看天池与温泉森林'],
  ['哈尔滨冰雪大世界', '哈尔滨', '黑龙江省', ['冰雪', '冬季', '夜景'], '适合冬季夜游、冰雕和东北城市体验'],
  ['漠河北极村', '大兴安岭', '黑龙江省', ['极北', '冰雪', '边境'], '适合冬季找北、雪原和边境小镇体验'],
  ['黄果树瀑布', '安顺', '贵州省', ['瀑布', '喀斯特', '自然'], '适合一日看大瀑布、水帘洞和峡谷水景'],
]

export const HOME_SCENIC_SPOTS: HomeScenicSpot[] = scenicSpotSeeds.map(
  (seed, index) => {
    const [name, city, province, tags, focus] = seed

    return {
      id: `home-spot-${String(index + 1).padStart(3, '0')}`,
      name,
      city,
      province,
      imageUrl: scenicImageUrlsByName[name] ?? fallbackScenicImageUrl,
      description: `${focus}。`,
      tags: [...tags],
      heightVariant: heightVariants[index % heightVariants.length],
      detail: buildSpotDetail(seed),
    }
  },
)
